var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');

var spawn = require('child_process').spawn;
var proc;

//app.use('/', express.static(path.join(__dirname, 'stream')));
app.use(express.static(__dirname + '/public'));


app.get('/', function(req, res) {
//  res.sendFile(__dirname + '/index.html');
  res.redirect('/index.html');
});

var sockets = {};

io.on('connection', function(socket) {

  sockets[socket.id] = socket;
  console.log("Total clients connected : ", Object.keys(sockets).length);

  socket.on('disconnect', function() {
    delete sockets[socket.id];
    console.log("Total clients connected : ", Object.keys(sockets).length);

    // no more sockets, kill the stream
    if (Object.keys(sockets).length == 0) {
      console.log("No more sockets exist, stopping the stream ...");
      app.set('watchingFile', false);
      if (proc) {
        console.log("Stopping the camera ...");
        proc.kill();
        proc = null;
      }
      fs.unwatchFile('public/img/image_stream.jpg');
    }
  });

  socket.on('start-stream', function() {
    startStreaming(io);
  });

});

http.listen(3000, function() {
  console.log('listening on *:3000');
});

function stopStreaming() {
  if (Object.keys(sockets).length == 0) {
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('/tmpfiles/image_stream.jpg');
  }
}

function startStreaming(io) {

  if (app.get('watchingFile')) {
    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
    return;
  }

  var args = ["-w", "320", "-h", "240", "-o", "public/img/image_stream.jpg", "-t", "999999999", "-tl", "100"];
  proc = spawn('raspistill', args);

  console.log('Watching for changes...');

  app.set('watchingFile', true);

  fs.watchFile('public/img/image_stream.jpg', function(current, previous) {
    var now = new Date();
    console.log("New image emitted " + now.toTimeString());
//    io.sockets.emit('liveStream', 'img/image_stream.jpg?_t=' + (Math.random() * 100000));
    io.sockets.emit('liveStream', 'img/image_stream.jpg?_t=' + now.toTimeString());
  })

}
