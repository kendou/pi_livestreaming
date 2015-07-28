var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var proc;
var fileWatcher = null;
var imgPath = "public/img/image_stream.jpg";
var imgUrlPath = "img/image_stream.jpg";
var startStreaming;
var stopStreaming;
var startWatch;
var stopWatch;

//////////////////////////////////////////////////////Begin utility methods
stopStreaming = function() {
  console.log("stopping streaming ...");
  if (proc) {
    proc.kill();
    proc = null;
  }
//    fs.unwatchFile(imgPath);
  stopWatch();
};

startStreaming = function(io) {

  if (app.get('watchingFile')) {
    io.sockets.emit('liveStream', imgUrlPath);
    return;
  }
  /*
   "-w 320 -h 240": capturing 320 x 240 image
   "-o public/img/image_stream.jpg": output to public/img/image_stream.jpg. In our case, it's a Ramdisk(tmpfs)
   "-t 999999999": run 999999999 miseconds. But somehow it stops outputing after about 2 hours
   "-tl 1000": Timelapse mode, taking picture every 1000 misecond. Better to have a value greater than 500
   "-n": no preview.

   Other options:
   "-q 50": jpeg quality 50%
   "> /home/pi/camera.log 2>&1": logs
   */
  var args = ["-w", "320", "-h", "240", "-o", imgPath, "-t", "999999999", "-tl", "1000", "-n"];
  proc = spawn('raspistill', args);
  proc.stdout.on('data', function(data){
    console.log("[raspistill] " + data);
  });
  proc.stderr.on('data', function(data){
    console.log("[raspistill error] " + data);
  });
  proc.on('exit', function(code, signal){
    //if "raspistill" process ends for any reason, stop watching
    console.log("raspistill exited with code:" + code);
    stopWatch();
  });

  console.log('Watching for changes...');

  /*
   fs.watchFile(imgPath, function(current, previous) {
   var now = new Date();
   console.log("New image emitted " + now.toTimeString());
   io.sockets.emit('liveStream', imgUrlPath + '?_t=' + now.toTimeString());
   })
   */
  //Change from watchFile to watch
  startWatch();
};

startWatch = function(){
  var watchCallback = function(event, filename){
    if( 'change' === event) {
      var now = new Date();
//      console.log("New image emitted " + now.toTimeString());
      io.sockets.emit('liveStream', imgUrlPath + '?_t=' + now.toTimeString());
    }
    else if( 'rename' === event) {
      //rewatch the file, otherwise the 'change' event only fire once.
      fileWatcher.close();
      fileWatcher = fs.watch(imgPath, {persistent: true}, watchCallback);
    }
  };

  console.log("current directory:" + process.cwd() + ", about to watch: " + imgPath);
  fileWatcher = fs.watch(imgPath, {persistent: true}, watchCallback);
  console.log("Start to watch the image file.");
  app.set('watchingFile', true);
};

stopWatch = function(){
  if(fileWatcher){
    console.log("Stop watching the image file.")
    fileWatcher.close();
    fileWatcher = null;
  }
  app.set('watchingFile', false);
};

///////////////////////////////////////////////////////End Utility Methods

//do something when app is closing
process.on('SIGTERM', function(){
  console.log("node application exiting, cleaning up ...");
  stopWatch();
  process.exit(0);
});

process.on('exit', function(code){
  console.log("node about to exit with code:" + code);
});

//app.use('/', express.static(path.join(__dirname, 'stream')));
app.use(express.static(__dirname + '/public'));


app.get('/', function(req, res) {
//  res.sendFile(__dirname + '/index.html');
  res.redirect('/index.html');
});

var sockets = {};

io.on('connection', function(socket) {

  sockets[socket.id] = socket;

  console.log("Connected from " + socket.request.connection.remoteAddress
    + " Total clients connected : ", Object.keys(sockets).length);

  socket.on('disconnect', function() {
    delete sockets[socket.id];
    console.log("Total clients connected : ", Object.keys(sockets).length);

    // no more sockets, kill the stream
    if (Object.keys(sockets).length == 0) {
      stopStreaming();
    }
  });

  socket.on('start-stream', function() {
    startStreaming(io);
  });

});

http.listen(3000, function() {
  console.log('listening on *:3000');
});



