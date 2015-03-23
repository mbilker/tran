'use strict';

var fs = require('fs');
var net = require('net');

var statusBar = require('status-bar');

var DIVIDER = '||'
var PREFIX = 'ACK_FILE' + DIVIDER;
var START_SENDING = 'ACK_STARTSEND';

function _createStatusBar(fileName, fileSize) {
  return statusBar.create({ total: fileSize }).on('render', function(stats) {
    process.stdout.write(fileName + ' ' +
      this.format.storage(stats.currentSize) + ' ' +
      this.format.speed(stats.speed) + ' ' +
      this.format.time(stats.remainingTime) + ' [' +
      this.format.progressBar(stats.percentage) + '] ' +
      this.format.percentage(stats.percentage));
    process.stdout.cursorTo(0);
  });
}

exports.send = function send(file, host, port) {
  var stat = fs.statSync(file);
  var socket = net.createConnection({ host: host, port: port });

  var bar = null;

  socket.once('data', function(chunk) {
    var info = chunk.toString('utf8');

    if (info === START_SENDING) {
      console.log('acknowlege received, sending file data...');

      bar = _createStatusBar(file, stat.size);

      fs.createReadStream(file).on('data', function(chunk) {
        socket.write(chunk, function() {
          bar.write(chunk);
        });
      });

      bar.on('finish', function() {
        process.stdout.clearLine();
        process.stdout.write('waiting for other client to finish writing file.');
        process.stdout.cursorTo(0);
      });
    }
  });

  socket.on('end', function() {
    console.log();
    console.log('connection closed');
  });

  socket.write(PREFIX + stat.size + DIVIDER + file + '\n');
}

exports.receive = function receive(port) {
  var clientConnected = false;

  var server = net.createServer(function(conn) {
    if (clientConnected) {
      return conn.end();
    }

    clientConnected = true;

    var file = null,
        size = null,
        bar  = null;

    function _afterInfoReceive() {
      bar  = _createStatusBar(file, size);

      var writeStream = fs.createWriteStream(file);

      conn.on('data', function(chunk) {
        writeStream.write(chunk, function() {
          bar.write(chunk);
        });
      });

      bar.on('finish', function() {
        conn.end();
        server.close();

        console.log();
        console.log(file + ' written');
      });
    }

    conn.once('data', function(chunk) {
      var info = chunk.toString('utf8');
      if (info.substr(0, PREFIX.length) === PREFIX) {
        var fileAndSize = info.substr(PREFIX.length, info.length).trim().split(DIVIDER);
        size = fileAndSize[0];
        file = fileAndSize[1];

        console.log('file name: ' + file);

        _afterInfoReceive();

        conn.write(START_SENDING);
      }
    });
  });

  server.listen(port, function() {
    console.log('listener bound to port ' + port);
  });
}
