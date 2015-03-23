# tran

A *very simple* program to transfer files between 2 hosts p2p.

## Install
Install with `npm install -g`

## Usage
Run the program in one of two modes:

Mode|Description|Arguments
r(eceive)|To receive a file.|--port <port to listen on>
s(end)|To send a file to another host|--host <destination ip> --port <port to connect to> <file to send>

## Example Receive
```sh
tran r -p 9999
```

Receiver listening on port 9999 and will save the file it receives to its original filename

### Example Send
```sh
tran s -h HostName.domain -p 9999 Test-File.mkv
```
