/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Shaka Player demo, main section.
 *
 * @suppress {visibility} to work around compiler errors until we can
 *   refactor the demo into classes that talk via public method.  TODO
 */

/** @suppress {duplicate} */
var lightDemo = lightDemo || {}; // eslint-disable-line no-var

/** @private {!Array.<HTMLOptGroupElement>} */
lightDemo.onlineOptGroups_ = [];

/**
 * @return {!Promise}
 * @private
 */
lightDemo.setupAssets_ = function() {
  // Populate the asset list.
  let assetList = document.getElementById("assetList");
  /** @type {!Object.<string, !HTMLOptGroupElement>} */
  let groups = {};
  let first = null;
  shakaAssets.enabledAssets.forEach(function(asset) {
    if (asset.disabled) return;

    let group = groups[asset.source];
    if (!group) {
      group = /** @type {!HTMLOptGroupElement} */ (document.createElement(
        "optgroup"
      ));
      group.label = asset.source;
      group.disabled = !navigator.onLine;
      groups[asset.source] = group;
      assetList.appendChild(group);
      lightDemo.onlineOptGroups_.push(group);
    }

    let option = document.createElement("option");
    option.textContent = asset.name;
    option.asset = asset; // custom attribute to map back to the asset
    group.appendChild(option);

    if (
      asset.drm.length &&
      !asset.drm.some(function(keySystem) {
        return lightDemo.support_.drm[keySystem];
      })
    ) {
      option.disabled = true;
    }

    let mimeTypes = [];
    if (asset.features.indexOf(shakaAssets.Feature.WEBM) >= 0) {
      mimeTypes.push("video/webm");
    }
    if (asset.features.indexOf(shakaAssets.Feature.MP4) >= 0) {
      mimeTypes.push("video/mp4");
    }
    if (asset.features.indexOf(shakaAssets.Feature.MP2TS) >= 0) {
      mimeTypes.push("video/mp2t");
    }
    if (
      !mimeTypes.some(function(type) {
        return lightDemo.support_.media[type];
      })
    ) {
      option.disabled = true;
    }

    if (!option.disabled && !group.disabled) {
      first = first || option;
      if (asset.focus) first = option;
    }
  });

  if (first) {
    first.selected = true;
  }

  // This needs to be started before we add the custom asset option.
  let asyncOfflineSetup = lightDemo.setupOfflineAssets_();

  // Add an extra option for custom assets.
  // let option = document.createElement('option');
  // option.textContent = '(custom asset)';
  // assetList.appendChild(option);

  assetList.addEventListener("change", function() {
    lightDemo.load();
    // Show/hide the custom asset fields based on the selection.
    // let asset = assetList.options[assetList.selectedIndex].asset;
    // let customAsset = document.getElementById('customAsset');
    // customAsset.style.display = asset ? 'none' : 'block';

    // Update the hash to reflect this change.
    lightDemo.hashShouldChange_();
  });

  // document.getElementById('loadButton').addEventListener(
  //     'click', lightDemo.load);
  // document.getElementById('unloadButton').addEventListener(
  //     'click', lightDemo.unload);
  // document.getElementById('licenseServerInput').addEventListener(
  //     'keyup', lightDemo.onAssetKeyUp_);
  // document.getElementById('manifestInput').addEventListener(
  //     'keyup', lightDemo.onAssetKeyUp_);
  // document.getElementById('certificateInput').addEventListener(
  //     'keyup', lightDemo.onAssetKeyUp_);

  return asyncOfflineSetup;
};

/**
 * @param {!Event} event
 * @private
 */
lightDemo.onAssetKeyUp_ = function(event) {
  // Mirror the users input as they type.
  lightDemo.hashShouldChange_();
  // Load the asset if the user presses enter.
  if (event.keyCode != 13) return;
  lightDemo.load();
};

/**
 * @param {!string} uri
 * @return {!Promise.<ArrayBuffer>}
 * @private
 */
lightDemo.requestCertificate_ = function(uri) {
  let netEngine = lightDemo.player_.getNetworkingEngine();
  const requestType = shaka.net.NetworkingEngine.RequestType.APP;
  let request = /** @type {shakaExtern.Request} */ ({ uris: [uri] });

  return netEngine
    .request(requestType, request)
    .promise.then(response => response.data);
};

/**
 * @param {ArrayBuffer} certificate
 * @private
 */
lightDemo.configureCertificate_ = function(certificate) {
  let player = lightDemo.player_;
  let config = player.getConfiguration();
  let certConfig = {};

  for (let keySystem in config.drm.advanced) {
    certConfig[keySystem] = {
      serverCertificate: new Uint8Array(certificate)
    };
  }

  player.configure({
    drm: {
      advanced: certConfig
    }
  });
};

/**
 * Prepares the Player to load the given assets by setting the configuration
 * values.  This does not load the asset.
 *
 * @param {?shakaAssets.AssetInfo} asset
 * @return {shakaAssets.AssetInfo}
 * @private
 */
lightDemo.preparePlayer_ = function(asset) {
  lightDemo.closeError();

  let player = lightDemo.player_;

  // let videoRobustness =
  //     document.getElementById('drmSettingsVideoRobustness').value;
  // let audioRobustness =
  //     document.getElementById('drmSettingsAudioRobustness').value;

  let commonDrmSystems = [
    "com.widevine.alpha",
    "com.microsoft.playready",
    "com.adobe.primetime"
  ];
  let config = /** @type {shakaExtern.PlayerConfiguration} */ ({
    abr: {},
    streaming: {},
    manifest: { dash: {} }
  });
  config.drm = /** @type {shakaExtern.DrmConfiguration} */ ({
    advanced: {}
  });
  commonDrmSystems.forEach(function(system) {
    config.drm.advanced[
      system
    ] = /** @type {shakaExtern.AdvancedDrmConfiguration} */ ({});
  });
  config.manifest.dash.clockSyncUri =
    "//shaka-player-demo.appspot.com/time.txt";

  if (!asset) {
    // Use the custom fields.
    let licenseServerUri = document.getElementById("licenseServerInput").value;
    let licenseServers = {};
    if (licenseServerUri) {
      commonDrmSystems.forEach(function(system) {
        licenseServers[system] = licenseServerUri;
      });
    }

    asset = /** @type {shakaAssets.AssetInfo} */ ({
      manifestUri: document.getElementById("manifestInput").value,
      // Use the custom license server for all key systems.
      // This simplifies configuration for the user.
      // They will simply fill in a Widevine license server on Chrome, etc.
      licenseServers: licenseServers,
      // Use custom certificate for all key systems as well
      certificateUri: document.getElementById("certificateInput").value
    });
  }

  // player.resetConfiguration();

  // Add configuration from this asset.
  // lightDemoUtils.setupAssetMetadata(asset, player);
  // lightDemo.castProxy_.setAppData({'asset': asset});

  // // Add drm configuration from the UI.
  // if (videoRobustness) {
  //   commonDrmSystems.forEach(function(system) {
  //     config.drm.advanced[system].videoRobustness = videoRobustness;
  //   });
  // }
  // if (audioRobustness) {
  //   commonDrmSystems.forEach(function(system) {
  //     config.drm.advanced[system].audioRobustness = audioRobustness;
  //   });
  // }

  // // Add other configuration from the UI.
  // config.preferredAudioLanguage =
  //     document.getElementById('preferredAudioLanguage').value;
  // config.preferredTextLanguage =
  //     document.getElementById('preferredTextLanguage').value;
  // config.abr.enabled =
  //     document.getElementById('enableAdaptation').checked;
  // let smallGapLimit = document.getElementById('smallGapLimit').value;
  // if (!isNaN(Number(smallGapLimit)) && smallGapLimit.length > 0) {
  //   config.streaming.smallGapLimit = Number(smallGapLimit);
  // }
  // config.streaming.jumpLargeGaps =
  //     document.getElementById('jumpLargeGaps').checked;

  // // When we use native controls, we must always stream text.
  // // See comments in onNativeChange_ for details.
  // config.streaming.alwaysStreamText =
  //     document.getElementById('showNative').checked;

  // player.configure(config);

  // // TODO: document demo app debugging features
  // if (window.debugConfig) {
  //   player.configure(window.debugConfig);
  // }

  return asset;
};

/** Compute which assets should be disabled. */
lightDemo.computeDisabledAssets = function() {
  // TODO: use remote support probe, recompute asset disabled when casting?
  lightDemo.onlineOptGroups_.forEach(function(group) {
    group.disabled = !navigator.onLine;
  });
};

/** Load the selected asset. */
lightDemo.load = function() {
  let assetList = document.getElementById("assetList");
  let option = assetList.options[assetList.selectedIndex];
  let player = lightDemo.player_;

  let asset = lightDemo.preparePlayer_(option.asset);

  // Revert to default poster while we load.
  lightDemo.localVideo_.poster = lightDemo.mainPoster_;

  let configureCertificate = Promise.resolve();

  if (asset.certificateUri) {
    configureCertificate = lightDemo
      .requestCertificate_(asset.certificateUri)
      .then(lightDemo.configureCertificate_);
  }

  configureCertificate
    .then(function() {
      // Load the manifest.
      return player.load(asset.manifestUri);
    })
    .then(
      function() {
        // Update control state in case autoplay is disabled.
        lightDemo.controls_.loadComplete();

        lightDemo.hashShouldChange_();

        // Set a different poster for audio-only assets.
        if (player.isAudioOnly()) {
          lightDemo.localVideo_.poster = lightDemo.audioOnlyPoster_;
        }

        // Disallow casting of offline content.
        let isOffline = asset.manifestUri.indexOf("offline:") == 0;
        lightDemo.controls_.allowCast(!isOffline);

        (asset.extraText || []).forEach(function(extraText) {
          player.addTextTrack(
            extraText.uri,
            extraText.language,
            extraText.kind,
            extraText.mime,
            extraText.codecs
          );
        });

        // Check if browser supports Media Session first.
        if ("mediaSession" in navigator) {
          // Set media session title.
          navigator.mediaSession.metadata = new MediaMetadata({
            title: asset.name
          });
        }
      },
      function(reason) {
        let error = /** @type {!shaka.util.Error} */ (reason);
        if (error.code == shaka.util.Error.Code.LOAD_INTERRUPTED) {
          // Don't use shaka.log, which is not present in compiled builds.
          console.debug("load() interrupted");
        } else {
          lightDemo.onError_(error);
        }
      }
    );

  // While the manifest is being loaded in parallel, go ahead and ask the video
  // to play.  This can help with autoplay on Android, since Android requires
  // user interaction to play a video and this function is called from a click
  // event.  This seems to work only because Shaka Player has already created a
  // MediaSource object and set video.src.
  lightDemo.video_.play();
};

/** Unload any current asset. */
lightDemo.unload = function() {
  lightDemo.player_.unload();
};
