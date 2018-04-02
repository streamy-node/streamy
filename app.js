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
