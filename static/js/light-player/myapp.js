// myapp.js

var lightDemo = lightDemo || {};  // eslint-disable-line no-var

console.log("uri: ");

var manifestUri = null;

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

//let type = lightDemo.getURLParameter_("type");
let id = lightDemo.getURLParameter_("id");
let folderName = lightDemo.getURLParameter_("folder_name");
let mpdGenId = lightDemo.getURLParameter_("mpd_gen_id");

var protocol = location.protocol;
var slashes = protocol.concat("//");
var host = slashes.concat(window.location.hostname)+":"+location.port;

//TODO prefered language
// config.preferredAudioLanguage = document.getElementById('preferredAudioLanguage').value;
// config.preferredTextLanguage = document.getElementById('preferredTextLanguage').value;

function addMPDAsset(mpdFile,index = null){
  let title = mpdFile.title;
  if(index){
    title += " ("+index.toString()+")";
  }
  shakaAssets.enabledAssets.push({
    name: title,//TODO put explicit name
    manifestUri: host+mpdFile.filename,
    encoder: shakaAssets.Encoder.STREAMY,
    source: shakaAssets.Source.STREAMY,
    drm: [],
    features: [
      shakaAssets.Feature.HIGH_DEFINITION,
      shakaAssets.Feature.MP4,
      shakaAssets.Feature.SEGMENT_BASE,
      shakaAssets.Feature.SUBTITLES
    ]
  });
}

lightDemo.loadMpdFiles = function() {
  if(mpdGenId){
    $.getJSON( "/media/"+id+"/gen_mpd_file/"+folderName+"/"+mpdGenId, function( mpdfile ) {
      addMPDAsset(mpdfile);
      lightDemo.startPlayer();
    });
  }else if(folderName){
    $.getJSON( "/media/"+id+"/mpd_file/"+folderName, function( mpdfile ) {
      addMPDAsset(mpdfile);
      lightDemo.startPlayer();
    });
  }else{
    $.getJSON( "/media/"+id+"/mpd_files", function( mpdfiles ) {
      for(let i=0; i<mpdfiles.length; i++){
        addMPDAsset(mpdfiles[i],i);
      }
      lightDemo.startPlayer();
    });
  }
}
// get manifest


//manifestUri = decodeURIComponent(lightDemo.getURLParameter_("episode_id"));

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

  //Check support (highlight only compatible streams)
  shaka.Player.probeSupport().then(function(support) {
  lightDemo.support_ = support;

    // Create a Player instance.
    let localVideo = document.getElementById('video');
    let localPlayer = new shaka.Player(video);
    //shaka.log.setLevel(shaka.log.Level.V2);//V2

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
    
    lightDemo.loadMpdFiles();
    // Try to load a manifest.
    // This is an asynchronous process.
    // lightDemo.player_.load(manifestUri).then(function() {
    //   // This runs if the asynchronous load is successful.
    //   console.log('The video has now been loaded!');
    // }).catch(lightDemo.onError);  // onError is executed if the asynchronous load fails.
  }).catch(function(error) {
    // Some part of the setup of the demo app threw an error.
    // Notify the user of this.
    console.error("Player error",error);
    //shakaDemo.onError_(/** @type {!shaka.util.Error} */ (error));
  });
}

lightDemo.startPlayer = function() {
  let asyncSetup = lightDemo.setupAssets_();
  lightDemo.setupOffline_();
  //lightDemo.setupConfiguration_();
  lightDemo.setupInfo_();

  lightDemo.controls_ = new ShakaControls();
  lightDemo.controls_.init(lightDemo.castProxy_, lightDemo.onError,
                              lightDemo.onCastStatusChange_);

  asyncSetup.catch(function(error) {
    // shakaDemo.setupOfflineAssets_ errored while trying to
    // load the offline assets. Notify the user of this.
    lightDemo.onError_(/** @type {!shaka.util.Error} */ (error));
  }).then(function() {
    //lightDemo.postBrowserCheckParams_(params);
    window.addEventListener('hashchange', lightDemo.updateFromHash_);
  });

  lightDemo.load();

}

/** @private */
lightDemo.hashShouldChange_ = function() {
  if (!lightDemo.hashCanChange_) {
    return;
  }

  let params = [];
  let oldParams = shakaDemo.getParams_();

  // Save the current asset.
  let assetUri;
  let licenseServerUri;
  if (lightDemo.player_) {
    assetUri = lightDemo.player_.getManifestUri();
    let drmInfo = lightDemo.player_.drmInfo();
    if (drmInfo) {
      licenseServerUri = drmInfo.licenseServerUri;
    }
  }
  let assetList = document.getElementById('assetList');
  if (assetUri) {
    // Store the currently playing asset URI.
    params.push('asset=' + assetUri);

    // Is the asset a default asset?
    let isDefault = false;
    // Check all options except the last, which is 'custom asset'.
    for (let index = 0; index < assetList.options.length - 1; index++) {
      if (assetList[index].asset.manifestUri == assetUri) {
        isDefault = true;
        break;
      }
    }

    // If it's a custom asset we should store whatever the license
    // server URI is.
    if (!isDefault && licenseServerUri) {
      params.push('license=' + licenseServerUri);
    }
  } else {
      // It's a default asset.
      params.push('asset=' +
          assetList[assetList.selectedIndex].asset.manifestUri);
  }
};

lightDemo.onCastStatusChange_ = function(isRunning){
	if(isRunning){
		console.log('Casting');
	}else{
		console.log('Stop Casting');
	}
}

lightDemo.onErrorEvent = function(event) {
  // Extract the shaka.util.Error object from the event.
  lightDemo.onError_(event.detail);
}

lightDemo.onError_ = function(error) {
  // Log the error.
  console.error('Player error', error.message);
  console.error('Error code', error.code, 'object', error);
	console.error('error.data', error.data[0]);
}

/**
 * Closes the error bar.
 */
lightDemo.closeError = function() {
  // document.getElementById('errorDisplay').style.display = 'none';
  // let link = document.getElementById('errorDisplayLink');
  // link.href = '';
  // link.textContent = '';
  // link.severity = null; 
};

//TODO poster
lightDemo.mainPoster_ = "poster";

shaka.polyfill.installAll();
//shaka.polyfill.Fullscreen.install();
//shaka.polyfill.PatchedMediaKeysMs.install();
//shaka.polyfill.PatchedMediaKeysWebkit.install();

document.addEventListener('DOMContentLoaded', lightDemo.initPlayer);
