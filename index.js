'use strict';

var fs = require('fs');
var net = require('net');

var bar = require('transfer-bar');

var PREFIX = 'ACK_FILE||';
var START_SENDING = 'ACK_STARTSEND';

exports.send = function send(file, host, port) {
  var socket = net.createConnection({ host: host, port: port });

  socket.once('data', function(chunk) {
    var info = chunk.toString('utf8');

    if (info === START_SENDING) {
      console.log('acknowlege received, sending file data...');

      var stat = fs.statSync(file);
      var b = bar(stat.size);
      var written = 0;

      fs.createReadStream(file).on('data', function(chunk) {
        socket.write(chunk);

        written += chunk.length;
        b.update(written);
      }).on('end', function() {
        socket.end();
      });
    }
  });
  socket.write(PREFIX + file + '\n');
}

exports.receive = function receive(port) {
  var clientConnected = false;

  var server = net.createServer(function(conn) {
    if (clientConnected) {
      return conn.end();
    }

    clientConnected = true;

    var file = null;

    conn.once('data', function(chunk) {
      var info = chunk.toString('utf8');
      if (info.substr(0, PREFIX.length) === PREFIX) {
        file = info.substr(PREFIX.length, info.length).trim();

        console.log('file name: ' + file);
        conn.pipe(fs.createWriteStream(file));

        conn.write(START_SENDING);
      }
    });

    conn.once('end', function() {
      server.close();
    });
  });

  server.listen(port, function() {
    console.log('listener bound to port ' + port);
  });
}
