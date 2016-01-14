'use strict';

var fs = require('fs');
var net = require('net');
var util = require('util');

var async = require('async');
var keyMirror = require('keymirror');
var statusBar = require('status-bar');

var API_VERSION = 1;

var DIVIDER = '||'
var States = Object.freeze(keyMirror({
  SENDING_VERSION: null,
  VERSION_ACK: null,

  LIST_OF_FILES: null,
  FILES_LIST_ACK: null,

  READY_TO_SEND_FILE: null,
  FILE_SEND_ACK: null,

  SENDING_FILE: null
}));

var currentState = null;

// The current flow for sending is:
// * Wait for connection
// * Connection established
// * Server sends version string
// * Client checks version to see if it matches
// * If version matches, send success message
// * If not match, send failure message and close connection
// * Send amount of files and JSON encoded list of filenames
// * Begin sending each file
// * Close connection

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

function sendListOfFilesAndWaitForSendReady(files, socket) {
  var filesBase64 = new Buffer(JSON.stringify(files), 'utf8').toString('base64');

  socket.on('data', function onFilesList(chunk) {
    var info = chunk.toString('utf8');

    if (info.substr(0, States.FILES_LIST_ACK.length) === States.FILES_LIST_ACK) {
      socket.write(States.READY_TO_SEND_FILE);
    } else if (info.substr(0, States.FILE_SEND_ACK.length) === States.FILE_SEND_ACK) {
      socket.removeEventListener('data', onFilesList);

      beginSendOfFileData(files, socket);
    }
  });

  socket.write([States.LIST_OF_FILES, files.length, filesBase64].join(DIVIDER)));
}

function beginSendOfFileData(files, socket) {
  console.log('acknowlege received, sending file data...');

  async.eachSeries(files, function(file, cb) {
    console.log('sending file ' + file);

    var stat = fs.statSync(file);
    var bar = _createStatusBar(file, stat.size);
    var readStream = fs.createReadStream(file);

    readStream.on('data', function(chunk) {
      var res = socket.write(chunk, function() {
        bar.write(chunk);
      });

      if (res === false) {
        readStream.pause();
      }
    });

    socket.on('drain', function() {
      readStream.resume();
    });

    readStream.on('end', function() {
      console.log('readStream end');
    });

    bar.on('finish', function() {
      process.stdout.clearLine();
      process.stdout.write('waiting for other client to finish writing file.');
      process.stdout.cursorTo(0);
    });

    // not going to continue writing this, going to try WebRTC data channels for communication (this will never send more than 1 file, will hang)
  });
}

exports.send = function send(files, host, port) {
  var socket = net.createConnection({ host: host, port: port });

  socket.once('connect', function() {
    socket.write([States.SENDING_VERSION, API_VERSION].join(DIVIDER));
  });

  socket.on('data', function onVersionResponse(chunk) {
    var info = chunk.toString('utf8');

    if (info.substr(0, States.VERSION_ACK.length) === States.VERSION_ACK) {
      socket.removeEventListener('data', onVersionResponse);

      sendListOfFiles(files, socket);
    }
  });

  socket.on('end', function() {
    console.log();
    console.log('connection closed');
  });
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
        var res = writeStream.write(chunk, function() {
          bar.write(chunk);
        });

        if (res === false) {
          conn.pause();
        }
      });

      writeStream.on('drain', function() {
        conn.resume();
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
