class SerieController extends ContentController {
  constructor(templates, sharedWebsocket) {
    super();
    this.templates = templates;
    this.blocks = new Map();
    this.mediaActiveProcess = new Map();
    this.blocksWithProgression = new Map();
    this.sws = sharedWebsocket;
    this.div = null;
  }

  /**
   * @override
   */
  _initialize() {
    var self = this;
    //Websocket
    var ws_transcoding = this.sws.subscribe("/notifications/transcoding");

    ws_transcoding.on("taskAdded", function(task) {
      self.updateProcess(task);
    });
    ws_transcoding.on("taskUpdated", function(task) {
      self.updateProcess(task);
    });
    ws_transcoding.on("taskRemoved", function(taskId) {
      //self.removeTask(taskId);
    });
  }

  pullProgressions() {
    var self = this;
    $.getJSON("transcoding_tasks", function(data) {
      self.updateProgressions(data);
    });
  }

  /**
   * @override
   */
  _render(div) {
    this.div = div;
    $(div).html(this.templates.serie);
    this.setupSerie();
  }

  // serie.html
  appendToContainer(containerId, elem) {
    $(containerId)
      .first()
      .append(elem);
  }

  renderSerie_elements(seriesInfos) {
    for (var i = 0; i < seriesInfos.length; i++) {
      this.appendToContainer(
        "#all_series",
        this.renderSeries_element(seriesInfos[i])
      );
    }
  }

  renderSerie_season(brickId, seasonInfos) {
    var template = $("#serie_season_tpl").clone();
    //console.log("template: ",template);
    template.attr("id", "");
    template.removeClass("hidden");
    template
      .find(".season_name")
      .attr("href", "#collapse_" + seasonInfos.season_number.toString());
    template.find(".season_name").append(seasonInfos.title);
    template
      .find(".panel-collapse")
      .attr("id", "collapse_" + seasonInfos.season_number.toString());

    if (seasonInfos.season_number == 6) {
      console.log("here");
    }
    for (var i = 0; i < seasonInfos.children.length; i++) {
      let episode = seasonInfos.children[i];
      let ep_tpl = $("#serie_episode_tpl").clone();
      //let data_path = "bricks/"+serieId+"/data/season_"+seasonInfos.season_number.toString()+"/episode_"+episode.episode_number.toString();
      let data_path =
        "bricks/" + brickId + "/" + encodeURIComponent(episode.path);

      ep_tpl.removeClass("hidden");
      ep_tpl.find(".box").attr("video_id", episode.id.toString());
      //ep_tpl.find("img").attr("src","series/"+serieId+"/data/season_"+seasonInfos.season_number.toString()+"/episode_"+episode.episode_number.toString()+"/fanart/img200.jpg");
      ep_tpl.find(".bloc-image").attr("src", data_path + "/fanart/img200.jpg");
      //ep_tpl.find('.episode-image').css('background-image', 'url(' + '"series/"+serieId+"/data/season_"+seasonInfos.season_number.toString()+"/episode_"+episode.episode_number.toString()+"/fanart/img200.jpg"' + ')');
      ep_tpl
        .find(".episode_number")
        .text(episode.episode_number.toString() + " - ");
      ep_tpl.find(".episode_title").text(episode.title);
      ep_tpl.find(".episode_overview").text(episode.overview);

      ep_tpl
        .find(".overview-expand")
        .attr(
          "href",
          "#collapse_overview_" +
            seasonInfos.season_number.toString() +
            "_" +
            episode.episode_number.toString()
        );
      ep_tpl
        .find(".episode_overview")
        .attr(
          "id",
          "collapse_overview_" +
            seasonInfos.season_number.toString() +
            "_" +
            episode.episode_number.toString()
        );

      //console.log("ep_tpl.html():",ep_tpl.html());
      template.find(".list-group").append(ep_tpl);

      let videoBock = new VideoBlock("episode", episode.id);
      videoBock.setup(ep_tpl);
      videoBock.setHasMpd(episode.has_mpd);
      this.blocks.set(episode.id, videoBock);
    }

    return template;
  }

  renderSerie_seasons(brickId, seasonsInfos) {
    this.blocks = new Map();
    for (var i = 0; i < seasonsInfos.length; i++) {
      this.appendToContainer(
        "#seasons",
        this.renderSerie_season(brickId, seasonsInfos[i])
      );
    }
  }

  setupSerie() {
    var self = this;
    //Get serie id
    var serieId = null;
    if (location.hash.substr(0, 6) === "#serie" && location.hash.length > 7) {
      //#serie_id
      //Extract id
      serieId = parseInt(location.hash.substr(7));
    } else {
      console.error("Invalid data");
    }

    //Render main description
    $.getJSON("media/" + serieId.toString(), function(mediaData) {
      $("#serieName").text(mediaData.title);
      $("#releasedate").text(mediaData.release_date.substr(0, 4));
      $("#rating").text(mediaData.rating);
      $("#ratingcount").text(mediaData.rating_count);
      $("#overview").text(mediaData.overview);
      $("#poster").attr(
        "src",
        "/bricks/" +
          mediaData.brick_id +
          "/" +
          encodeURIComponent(mediaData.path) +
          "/fanart/img500.jpg"
      );
      //$("#poster2").attr("src","/data/series/"+data.brick_id+"/"+data.original_name+" ("+data.release_date.substr(0,4)+")/fanart/img300.jpg");
      //$('#box-1').css('background-image', 'url(' + '"/data/series/'+data.brick_id+'/'+data.original_name+' ('+data.release_date.substr(0,4)+')/fanart/img300.jpg"' + ')');

      //Render seasons and episodes
      $.getJSON("series/" + serieId.toString() + "/seasons", function(data) {
        self.renderSerie_seasons(mediaData.brick_id, data);
        self.pullProgressions();
      });
    });

    $("#refresh").click(function() {
      //console.log("#addtitle/serie",videoInfos);
      postAsJson(
        {},
        "/media/" + serieId + "/refresh",
        function(response) {},
        function(response) {
          alert("Failed to refresh serie", response);
        }
      );
    });
  }

  removeProgress(filename) {
    //TODO
    //let videoBlock = this.blocks.get(progress.media_id)
  }

  updateProcess(progress) {
    let videoBlock = this.blocks.get(progress.media_id);
    if (videoBlock) {
      let previousProc = this.mediaActiveProcess.get(progress.media_id);

      if (previousProc && previousProc.filename == progress.filename) {
        videoBlock.updateStatus(
          progress.state_code,
          progress.progression,
          progress.msg
        );
      } else if (
        !previousProc ||
        new Date() - previousProc.lastTime > 10 || //If last update too old switch process
        progress.progression > previousProc.progression
      ) {
        // If progression is better switch to it
        this.mediaActiveProcess.set(progress.media_id, {
          filename: progress.filename,
          progression: progress.progression,
          lastTime: new Date()
        });
        videoBlock.updateStatus(
          progress.state_code,
          progress.progression,
          progress.msg
        );
      }
    }
  }

  updateProgressions(progressions) {
    if (location.hash.includes("#serie_") && progressions) {
      for (let items of this.blocks) {
        let videoId = items[0];
        let videoBlock = items[1];
        if (progressions.offline[videoId]) {
          let progressionsOnMedia = Object.values(
            progressions.offline[videoId]
          );
          let bestProgression = null;
          for (let i = 0; i < progressionsOnMedia.length; i++) {
            let progression = progressionsOnMedia[i];
            if (
              !bestProgression ||
              bestProgression.progression < progression.progression
            ) {
              bestProgression = progression;
            }
          }
          videoBlock.updateStatus(
            bestProgression.state_code,
            bestProgression.progression,
            bestProgression.msg
          );
          this.mediaActiveProcess.set(videoId, {
            filename: bestProgression.filename,
            progression: bestProgression.progression,
            lastTime: new Date()
          });
        }
      }
    }
  }
}
