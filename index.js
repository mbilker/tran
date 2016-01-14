'use strict';

var fs = require('fs');

var wrtc = require('wrtc');

var RTCPeerConnection = wrtc.RTCPeerConnection;

exports.send = function(files, host) {
  var pc = new RTCPeerConnection({
    iceServers: [],
  }, {
    optional: [ { DtlsSrtpKeyAgreement: false } ]
  });

  pc.ondatachannels = function() {
  }
}

exports.receive = function(files, host) {
}
