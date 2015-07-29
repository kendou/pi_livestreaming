var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var spawn = child_process.spawn;
var nconf = require('nconf');

var proc;
var fileWatcher = null;
var imgPath = "public/img/image_stream.jpg";
var imgUrlPath = "img/image_stream.jpg";
var imgUrlPathFakeMode = "img2/peep.jpg";
var startStreaming;
var stopStreaming;
var startWatch;
var stopWatch;
var writeLog;

//////////////////////////////////////////////////////Begin utility methods
stopStreaming = function() {
  writeLog("stopping streaming ...");
  if (proc) {
    proc.kill();
    proc = null;
  }
//    fs.unwatchFile(imgPath);
  stopWatch();
};

startStreaming = function(io) {
  if(nconf.get('fakeMode') === true){
    io.sockets.emit('liveStream', imgUrlPathFakeMode);
    return;
  }

  if (app.get('watchingFile')) {
    io.sockets.emit('liveStream', imgUrlPath);
    return;
  }

  //imgPath should exist otherwise the watch() call will fail.
  child_process.exec('touch ' + imgPath, function(){
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
      writeLog("[raspistill] " + data);
    });
    proc.stderr.on('data', function(data){
      writeLog("[raspistill error] " + data);
    });
    proc.on('exit', function(code, signal){
      //if "raspistill" process ends for any reason, stop watching
      writeLog("raspistill exited with code:" + code);
      stopWatch();
    });

    writeLog('Watching for changes...');

    /*
     fs.watchFile(imgPath, function(current, previous) {
     var now = new Date();
     writeLog("New image emitted " + now.toTimeString());
     io.sockets.emit('liveStream', imgUrlPath + '?_t=' + now.toTimeString());
     })
     */
    //Change from watchFile to watch
    startWatch();
  });
};

writeLog = function(logStr){
  var now = new Date();
  var timeString = "[" + now.getFullYear() + "/" + now.getMonth() + "/" + now.getDay()
    + " " + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds() + "]";
  console.log(timeString + logStr);
};

startWatch = function(){
  var watchCallback = function(event, filename){
    if( 'change' === event) {
      var now = new Date();
//      writeLog("New image emitted ");
      io.sockets.emit('liveStream', imgUrlPath + '?_t=' + now.toTimeString());
    }
    else if( 'rename' === event) {
      //rewatch the file, otherwise the 'change' event only fire once.
      fileWatcher.close();
      fileWatcher = fs.watch(imgPath, {persistent: true}, watchCallback);
    }
  };

//  writeLog("current directory:" + process.cwd() + ", about to watch: " + imgPath);
  fileWatcher = fs.watch(imgPath, {persistent: true}, watchCallback);
  writeLog("Start to watch the image file.");
  app.set('watchingFile', true);
};

stopWatch = function(){
  if(fileWatcher){
    writeLog("Stop watching the image file.")
    fileWatcher.close();
    fileWatcher = null;
  }
  app.set('watchingFile', false);
};

///////////////////////////////////////////////////////End Utility Methods
//Initializing config file
nconf.argv()
  .env()
  .file({ file: './config.json' });
//Set default values
nconf.set('port',3000);
nconf.set('fakemode', false);

//do something when app is closing
process.on('SIGTERM', function(){
  writeLog("node application exiting, cleaning up ...");
  stopStreaming();
  process.exit(0);
});

process.on('exit', function(code){
  writeLog("node about to exit with code:" + code);
  stopStreaming();
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

  writeLog("Connected from " + socket.request.connection.remoteAddress
    + " Total clients connected : ", Object.keys(sockets).length);

  socket.on('disconnect', function() {
    delete sockets[socket.id];
    writeLog("Total clients connected : ", Object.keys(sockets).length);

    // no more sockets, kill the stream
    if (Object.keys(sockets).length == 0) {
      stopStreaming();
    }
  });

  socket.on('start-stream', function() {
    startStreaming(io);
  });

});

http.listen(nconf.get('port'), function() {
  writeLog('listening on *:' + nconf.get('port'));
});



