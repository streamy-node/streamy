var express = require('express')
var cors = require('cors'); // Chrome cast

//Https
//var https = require('https');
//var fs = require('fs');

var app = express()

app.use(cors());
app.use(express.static('public'));

app.get('/', function (req, res) {
  res.send('Hello World!')
})

var server = app.listen(8080, function () {

	var host = server.address().address
  var port = server.address().port
  
	console.log("Streamy node listening at http://%s:%s", host, port)
})

//Test transcoder
var TranscoderManager = require('./src/transcoding/transcodemanager').FfmpegProcessManager;
var Process = require('./src/transcoding/transcodemanager').Process; 
var Hardware = require('./src/transcoding/transcodemanager').Hardware;
var transcoderMgr = new TranscoderManager();
transcoderMgr.addWorker("127.0.0.1",7000);

var args = [
  '-i',
  'examples/input.mp4',
  '-y',
  '-threads',
  '3',
  '-an',
  '-sn',
  '-c:v',
  'libx264',
  '-b:v:0',
  '4800k',
  '-profile',
  'main',
  '-keyint_min',
  '120',
  '-g',
  '120',
  '-b_strategy',
  '0',
  '-use_timeline',
  '1',
  '-use_template',
  '1',
  '-single_file',
  '1',
  '-single_file_name',
  'video_1.mp4',
  '-f',
  'dash',
  'kk.mpg'
]

var hw = new Hardware(1,0,0,0);
var firstrpoc;
for(var i=0; i<2; i++){
  !function inner(i){
    var ident = i.toString();
    var process = new Process("ffmpeg",args,10,hw,)
    .on('start',()=>{console.log("on start");})
    .on('stop',(restart)=>{console.log("on stop",ident,restart);})
    .on('progression',(msg)=>{console.log("on progression ",ident,msg);})
    .on('final',(msg)=>{console.log("on final",ident,msg);});
    // var process = new Process("ffmpeg",args,10,hw,
    // ()=>{console.log("on start");},
    // (restart)=>{console.log("on stop",ident,restart);},
    // (msg)=>{console.log("on progression ",ident,msg);},
    // (msg)=>{console.log("on final",ident,msg);});
    if(i==0){
      firstrpoc = process;
      firstrpoc.priority = 0;
    }
    transcoderMgr.launchProcess(process);
  }(i);
}

setTimeout(()=>{
  transcoderMgr.stopProcess(firstrpoc);
}, 15000, 'funky');

setTimeout(()=>{
  transcoderMgr.startProcess(firstrpoc);
}, 30000, 'funky2');



