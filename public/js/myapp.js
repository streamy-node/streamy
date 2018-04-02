// myapp.js
var myplayer = myplayer || {};
myplayer.CC_APP_ID_ = 'A15A181D';

var manifestUri = '//storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd';

function initApp() {
  // Install built-in polyfills to patch browser incompatibilities.
  shaka.polyfill.installAll();

  // Check to see if the browser supports the basic APIs Shaka needs.
  if (shaka.Player.isBrowserSupported()) {
    // Everything looks good!
    initPlayer();
  } else {
    // This browser does not have the minimum set of APIs we need.
    console.error('Browser not supported!');
  }
}

/**
 * @param {!shaka.util.Error} error
 * @private
 */
myplayer.onError_ = function(error) {
  console.error('Player error', error);
  var link = document.getElementById('errorDisplayLink');

  // Don't let less serious or equally serious errors replace what is already
  // shown.  The first error is usually the most important one, and the others
  // may distract us in bug reports.

  // If this is an unexpected non-shaka.util.Error, severity is null.
  if (error.severity == null) {
    // Treat these as the most severe, since they should not happen.
    error.severity = /** @type {shaka.util.Error.Severity} */(99);
  }

  // Always show the new error if:
  //   1. there is no error showing currently
  //   2. the new error is more severe than the old one
  if (link.severity == null ||
      error.severity > link.severity) {
    var message = error.message || ('Error code ' + error.code);
    if (error.code) {
      link.href = '../docs/api/shaka.util.Error.html#value:' + error.code;
    } else {
      link.href = '';
    }
    link.textContent = message;
    // By converting severity == null to 99, non-shaka errors will not be
    // replaced by any subsequent error.
    link.severity = error.severity || 99;
    // Make the link clickable only if we have an error code.
    link.style.pointerEvents = error.code ? 'auto' : 'none';
    document.getElementById('errorDisplay').style.display = 'block';
  }
};

function initPlayer() {
  // Create a Player instance.
  var video = document.getElementById('video');
  var player = new shaka.Player(video);

	// Add Cast
	/**
	 * The registered ID of the v2.3 Chromecast receiver demo.
	 * @const {string}
	 * @private
	 */
shaka.Player.probeSupport().then(function(support) {
      myplayer.support_ = support;

      var localVideo =
          /** @type {!HTMLVideoElement} */(document.getElementById('video'));
      var localPlayer = new shaka.Player(localVideo);
      myplayer.castProxy_ = new shaka.cast.CastProxy(
          localVideo, localPlayer, myplayer.CC_APP_ID_);

      myplayer.video_ = myplayer.castProxy_.getVideo();
      myplayer.player_ = myplayer.castProxy_.getPlayer();
      myplayer.player_.addEventListener('error', myplayer.onErrorEvent_);
      myplayer.localVideo_ = localVideo;
      myplayer.localPlayer_ = localPlayer;

      // Set the default poster.
      myplayer.localVideo_.poster = myplayer.mainPoster_;

      //var asyncSetup = myplayer.setupAssets_();
      //myplayer.setupOffline_();
      //myplayer.setupConfiguration_();
      //myplayer.setupInfo_();

      myplayer.controls_ = new ShakaControls();
      myplayer.controls_.init(myplayer.castProxy_, myplayer.onError_,
                               myplayer.onCastStatusChange_);

      //asyncSetup.catch(function(error) {
        // shakaDemo.setupOfflineAssets_ errored while trying to
        // load the offline assets. Notify the user of this.
      //  myplayer.onError_(/** @type {!shaka.util.Error} */ (error));
      //}).then(function() {
      //  myplayer.postBrowserCheckParams_(params);
      //  window.addEventListener('hashchange', myplayer.updateFromHash_);
      //});
    }).catch(function(error) {
      // Some part of the setup of the demo app threw an error.
      // Notify the user of this.
      myplayer.onError_(/** @type {!shaka.util.Error} */ (error));
    });
	

  // Attach player to the window to make it easy to access in the JS console.
  window.player = player;

  // Listen for error events.
  player.addEventListener('error', onErrorEvent);

  // Try to load a manifest.
  // This is an asynchronous process.
  player.load(manifestUri).then(function() {
    // This runs if the asynchronous load is successful.
    console.log('The video has now been loaded!');
  }).catch(onError);  // onError is executed if the asynchronous load fails.
}

function onErrorEvent(event) {
  // Extract the shaka.util.Error object from the event.
  onError(event.detail);
}

function onError(error) {
  // Log the error.
  console.error('Error code', error.code, 'object', error);
}

document.addEventListener('DOMContentLoaded', initApp);
