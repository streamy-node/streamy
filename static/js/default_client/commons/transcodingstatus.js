class TranscodingStatus {
  constructor(id) {
    this.element = null;
    this.isBroken = false;
    this.id = id;
    this.hasMpd = false;
  }

  setup(element) {
    var self = this;
    self.element = element;
    //Link media content button
    element.find(".mediacontent").attr("href", "#mediacontent_" + this.id);
  }

  setHasMpd(val) {
    this.hasMpd = val;
    this.setBroken(!val);
    this.hideProgression();
    this.setError(false);
  }

  setBroken(value, status_color = nofile_color) {
    this.isBroken = value;
    let $broken = this.element.find(".video_broken");

    $broken.css("color", status_color);

    if (value) {
      $broken.removeClass("d-none");
    } else {
      $broken.addClass("d-none");
    }
  }

  setError(value, status_color, message = null) {
    let $verror = this.element.find(".video_error");

    $verror.css("color", status_color);

    if (value) {
      if (message) {
        $verror.attr("title", "failed to add last file: " + message);
      } else {
        $verror.attr("title", "failed to add last file");
      }

      $verror.removeClass("d-none");
    } else {
      $verror.addClass("d-none");
    }
  }
  hideProgression() {
    let $progress = this.element.find(".video_progress");
    $progress.addClass("d-none");
  }

  showProgression(progression, stopped = false) {
    let $progress = this.element.find(".video_progress");
    $progress.text(progression + "%");
    $progress.removeClass("d-none");

    if (stopped) {
      $progress.removeClass("progression_running");
      $progress.addClass("progression_stopped");
    } else {
      $progress.addClass("progression_running");
      $progress.removeClass("progression_stopped");
    }
  }

  updateStatus(state, progression, msg = null) {
    if (state == 0) {
      this.setBroken(false);
      this.hideProgression();
      this.setError(false);
    } else if (state == 1) {
      this.setError(true, transcoding_error_color, msg);
      this.hideProgression();
      if (!this.hasMpd) this.setBroken(true, nofile_color);
    } else if (state == 2) {
      if (!this.hasMpd) this.setBroken(true, transcoding_color);
      this.showProgression(progression);
      this.setError(false);
    } else if (state == 3) {
      if (!this.hasMpd) this.setBroken(true, waiting_color);
      this.showProgression(progression);
      this.setError(false);
    } else if (state == 4) {
      if (!this.hasMpd) this.setBroken(true, waiting_color);
      this.showProgression(progression, true);
      this.setError(false);
    }
  }
}
