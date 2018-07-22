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
var lightDemo = lightDemo || {};  // eslint-disable-line no-var


/** @private {?HTMLOptGroupElement} */
lightDemo.offlineOptGroup_ = null;


/** @private {boolean} */
lightDemo.offlineOperationInProgress_ = false;


/**
 * @param {boolean} canHide True to hide the progress value if there isn't an
 *   operation going.
 * @private
 */
lightDemo.updateButtons_ = function(canHide) {
  let assetList = document.getElementById('assetList');
  let inProgress = lightDemo.offlineOperationInProgress_;

  document.getElementById('progressDiv').style.display =
      canHide && !inProgress ? 'none' : 'block';

  let option = assetList.options[assetList.selectedIndex];
  let storedContent = option.storedContent;
  // True if there is no DRM or if the browser supports persistent licenses for
  // any given DRM system.
  let supportsDrm = !option.asset || !option.asset.drm ||
      !option.asset.drm.length || option.asset.drm.some(function(drm) {
        return lightDemo.support_.drm[drm] &&
            lightDemo.support_.drm[drm].persistentState;
      });

  // Only show when the custom asset option is selected.
  document.getElementById('offlineNameDiv').style.display =
      option.asset ? 'none' : 'block';

  let button = document.getElementById('storeDeleteButton');
  button.disabled = (inProgress || !supportsDrm || option.isStored);
  button.textContent = storedContent ? 'Delete' : 'Store';
  let helpText = document.getElementById('storeDeleteHelpText');
  if (inProgress) {
    helpText.textContent = 'Operation is in progress...';
  } else if (!supportsDrm) {
    helpText.textContent = 'This browser does not support persistent licenses.';
  } else if (button.disabled) {
    helpText.textContent = 'The asset is stored offline. ' +
        'Checkout the "Offline" section in the "Asset" list';
  } else {
    helpText.textContent = '';
  }
};


/** @private */
lightDemo.setupOffline_ = function() {
  document.getElementById('storeDeleteButton')
      .addEventListener('click', lightDemo.storeDeleteAsset_);
  document.getElementById('assetList')
      .addEventListener('change', lightDemo.updateButtons_.bind(null, true));
  lightDemo.updateButtons_(true);
};


/**
 * @return {!Promise}
 * @private
 */
lightDemo.setupOfflineAssets_ = function() {
  const Storage = shaka.offline.Storage;
  if (!Storage.support()) {
    let section = document.getElementById('offlineSection');
    section.style.display = 'none';
    return Promise.resolve();
  }

  /** @type {!HTMLOptGroupElement} */
  let group;
  let assetList = document.getElementById('assetList');
  if (!lightDemo.offlineOptGroup_) {
    group =
        /** @type {!HTMLOptGroupElement} */ (
            document.createElement('optgroup'));
    lightDemo.offlineOptGroup_ = group;
    group.label = 'Offline';
    assetList.appendChild(group);
  } else {
    group = lightDemo.offlineOptGroup_;
  }

  let db = new Storage(lightDemo.localPlayer_);
  return db.list().then(function(storedContents) {
    storedContents.forEach(function(storedContent) {
      for (let i = 0; i < assetList.options.length; i++) {
        let option = assetList.options[i];
        if (option.asset &&
            option.asset.manifestUri == storedContent.originalManifestUri) {
          option.isStored = true;
          break;
        }
      }
      let asset = {manifestUri: storedContent.offlineUri};

      let option = document.createElement('option');
      option.textContent =
          storedContent.appMetadata ? storedContent.appMetadata.name : '';
      option.asset = asset;
      option.storedContent = storedContent;
      group.appendChild(option);
    });

    lightDemo.updateButtons_(true);
    return db.destroy();
  }).catch(function(error) {
    if (error.code == shaka.util.Error.Code.UNSUPPORTED_UPGRADE_REQUEST) {
      console.warn('Warning: storage cleared.  For details, see ' +
                   'https://github.com/google/shaka-player/issues/1248');
      shaka.offline.Storage.deleteAll();
      return;
    }

    // Let another component deal with it.
    throw error;
  });
};


/** @private */
lightDemo.storeDeleteAsset_ = function() {
  lightDemo.closeError();
  lightDemo.offlineOperationInProgress_ = true;
  lightDemo.updateButtons_(false);

  let assetList = document.getElementById('assetList');
  let progress = document.getElementById('progress');
  let option = assetList.options[assetList.selectedIndex];

  progress.textContent = '0';

  let storage = new shaka.offline.Storage(lightDemo.localPlayer_);
  storage.configure(/** @type {shakaExtern.OfflineConfiguration} */ ({
    progressCallback: function(data, percent) {
      progress.textContent = (percent * 100).toFixed(2);
    }
  }));

  let p;
  if (option.storedContent) {
    let offlineUri = option.storedContent.offlineUri;
    let originalManifestUri = option.storedContent.originalManifestUri;

    // If this is a stored demo asset, we'll need to configure the player with
    // license server authentication so we can delete the offline license.
    for (let i = 0; i < shakaAssets.testAssets.length; i++) {
      let originalAsset = shakaAssets.testAssets[i];
      if (originalManifestUri == originalAsset.manifestUri) {
        lightDemo.preparePlayer_(originalAsset);
        break;
      }
    }

    p = storage.remove(offlineUri).then(function() {
      for (let i = 0; i < assetList.options.length; i++) {
        let option = assetList.options[i];
        if (option.asset && option.asset.manifestUri == originalManifestUri) {
          option.isStored = false;
        }
      }
      return lightDemo.refreshAssetList_();
    });
  } else {
    let asset = lightDemo.preparePlayer_(option.asset);
    let nameField = document.getElementById('offlineName').value;
    let assetName = asset.name ? '[OFFLINE] ' + asset.name : null;
    let metadata = {name: assetName || nameField || asset.manifestUri};
    p = storage.store(asset.manifestUri, metadata).then(function() {
      if (option.asset) {
        option.isStored = true;
      }
      return lightDemo.refreshAssetList_().then(function() {
        // Auto-select offline copy of asset after storing.
        let group = lightDemo.offlineOptGroup_;
        for (let i = 0; i < group.childNodes.length; i++) {
          let option = group.childNodes[i];
          if (option.textContent == assetName) {
            assetList.selectedIndex = option.index;
          }
        }
      });
    });
  }

  p.catch(function(reason) {
    let error = /** @type {!shaka.util.Error} */(reason);
    lightDemo.onError_(error);
  }).then(function() {
    lightDemo.offlineOperationInProgress_ = false;
    lightDemo.updateButtons_(true /* canHide */);
    return storage.destroy();
  });
};


/**
 * @return {!Promise}
 * @private
 */
lightDemo.refreshAssetList_ = function() {
  // Remove all child elements.
  let group = lightDemo.offlineOptGroup_;
  while (group.firstChild) {
    group.removeChild(group.firstChild);
  }

  return lightDemo.setupOfflineAssets_();
};


/**
 * @param {boolean} connected
 * @private
 */
lightDemo.onCastStatusChange_ = function(connected) {
  if (!lightDemo.offlineOptGroup_) {
    // No offline support.
    return;
  }

  // When we are casting, offline assets become unavailable.
  lightDemo.offlineOptGroup_.disabled = connected;

  if (connected) {
    let assetList = document.getElementById('assetList');
    let option = assetList.options[assetList.selectedIndex];
    if (option.storedContent) {
      // This is an offline asset.  Select something else.
      assetList.selectedIndex = 0;
    }
  }
};
