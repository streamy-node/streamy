// myapp.js

var lightDemo = lightDemo || {};  // eslint-disable-line no-var

console.log("uri: ");

var manifestUri = null;
//var manifestUri = "http://192.168.1.69:80/videos/fftest/video1-bis.mpd"
//var manifestUri = "http://192.168.1.69:80/videos/fftest/video1.mpd"
//var manifestUri = "http://192.168.1.69:80/videos/fftest/all.mpd"
//var manifestUri = "http://192.168.1.69:80/videos/mp4boxvid/output.mpd"
//var manifestUri = 'http://192.168.1.69:80/videos/outputdash_one_file/output.mpd';
//var manifestUri = 'http://192.168.1.69:80/videos/outputdash5min/video.mpd';
//var manifestUri = 'http://192.168.1.69:80/videos/Money/video.mpd';
//var manifestUri = 'http://192.168.1.69:80/videos/out_copy4.mpd';
///var manifestUri = 'http://192.168.1.69:80/videos/outputdash_video_sub/output.mpd'
//var manifestUri = 'http://192.168.1.69:80/videos/outputdash_video/output.mpd'
//var manifestUri = 'http://192.168.1.69:80/videos/outputdash/output.mpd'
//var manifestUri = '/videos/car/car-20120827-manifest.mpd'
//var manifestUri = '//bitmovin-a.akamaihd.net/content/sintel/sintel.mpd'
//var manifestUri = '//storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd'
/**
 * The registered ID of the v2.3 Chromecast receiver demo.
 * https://developers.google.com/cast/docs/registration
 * @const {string}
 * @private
 */
lightDemo.CC_APP_ID_ = 'A15A181D';

/** @private {shaka.cast.CastProxy} */
lightDemo.castProxy_ = null;


/** @private {HTMLMediaElement} */
lightDemo.video_ = null;


/** @private {shaka.Player} */
lightDemo.player_ = null;


/** @private {ShakaControls} */
lightDemo.controls_ = null;

lightDemo.getURLParameter_ = function(sParam){
  var sPageURL = window.location.search.substring(1);
  var sURLVariables = sPageURL.split('&');
  for (var i = 0; i < sURLVariables.length; i++){
      var sParameterName = sURLVariables[i].split('=');
      if (sParameterName[0] == sParam)
      {
          return sParameterName[1];
      }
  }
}

manifestUri = decodeURIComponent(lightDemo.getURLParameter_("mdp"));

lightDemo.init = function() {
  // Install built-in polyfills to patch browser incompatibilities.
  shaka.polyfill.installAll();

  // Check to see if the browser supports the basic APIs Shaka needs.
  if (shaka.Player.isBrowserSupported()) {
    // Everything looks good!
    lightDemo.initPlayer();
  } else {
    // This browser does not have the minimum set of APIs we need.
    console.error('Browser not supported!');
  }
}

lightDemo.initPlayer = function() {
  // Create a Player instance.
  let localVideo = document.getElementById('video');
  let localPlayer = new shaka.Player(video);
	shaka.log.setLevel(shaka.log.Level.V2)

  lightDemo.castProxy_ =  new shaka.cast.CastProxy(
          localVideo, localPlayer, lightDemo.CC_APP_ID_);

  lightDemo.video_ = lightDemo.castProxy_.getVideo();
  lightDemo.player_ = lightDemo.castProxy_.getPlayer();
  lightDemo.player_.addEventListener('error', lightDemo.onErrorEvent);
  lightDemo.localVideo_ = localVideo;
  lightDemo.localPlayer_ = localPlayer;

  // Set the default poster.
  //shakaDemo.localVideo_.poster = shakaDemo.mainPoster_;

  // Attach player to the window to make it easy to access in the JS console.
  //window.player = player;

  // Listen for error events.
  lightDemo.player_.addEventListener('error', lightDemo.onErrorEvent);

	lightDemo.controls_ = new ShakaControls();
	lightDemo.controls_.init(lightDemo.castProxy_, lightDemo.onError,
                               lightDemo.onCastStatusChange_);
  // Try to load a manifest.
  // This is an asynchronous process.
	lightDemo.player_.load(manifestUri).then(function() {
    // This runs if the asynchronous load is successful.
    console.log('The video has now been loaded!');
  }).catch(lightDemo.onError);  // onError is executed if the asynchronous load fails.
}

lightDemo.onCastStatusChange_ = function(isRunning){
	if(isRunning){
		console.log('Casting');
	}else{
		console.log('Stop Casting');
	}
}

lightDemo.onErrorEvent = function(event) {
  // Extract the shaka.util.Error object from the event.
  lightDemo.onError(event.detail);
}

lightDemo.onError = function(error) {
  // Log the error.
  console.error('Player error', error.message);
  console.error('Error code', error.code, 'object', error);
	console.error('error.data', error.data[0]);
}


document.addEventListener('DOMContentLoaded', lightDemo.initPlayer);
