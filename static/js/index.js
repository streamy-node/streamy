class ContentManager{
  constructor(){
    this.langs = {};
    this.templates = {};
    this.sharedWebsocket = new SharedWebSocket;
    this.moviesMgr = new MoviesContent(this.templates,this.sharedWebsocket);
    this.movieMgr = new MovieContent(this.templates,this.sharedWebsocket);
    this.seriesMgr = new SeriesContent(this.templates);
    this.serieMgr = new SerieController(this.templates,this.sharedWebsocket);
    this.workersMgr = new WorkerController(this.templates,this.sharedWebsocket);
    this.mediaContentMgr = new MediaContentController(this.templates,this.sharedWebsocket);
    this.transcodingMgr = new TranscodingController(this.templates,this.sharedWebsocket)
    this.addVideoMgr = new AddVideoConstroller(this.templates)
  }

  load(code,onSuccess){
    var self = this;
    this.loadTemplates((templates)=>{
      self.loadLang(code,(lang)=>{
        for (var key in templates) {
          self.templates[key] = templates[key];
        }
        self.langs.active = lang;
        onSuccess();
      })
    })
  }

  loadTemplates(onSuccess){
    var self = this;
    $.when(
      $.get("movies.html"),
      $.get("movie.html"),
      $.get("series.html"),
      $.get("serie.html"),
      $.get("addvideo.html"),
      $.get("workers.html"),
      $.get("transcoding.html"),
      $.get("mediacontent.html"),
      $.get("common.html")).done(function(a1,a2,a3,a4,a5,a6,a7,a8,a9){
        var templates = {}
        templates.movies =  a1[0];
        templates.movie =  a2[0];
        templates.series =  a3[0];
        templates.serie =  a4[0];
        templates.addvideo =  a5[0];
        templates.workers =  a6[0];
        templates.transcoding =  a7[0];
        templates.mediacontent =  a8[0];
        templates.common =  a9[0];
        
      // the code here will be executed when all four ajax requests resolve.
      // a1, a2, a3 and a4 are lists of length 3 containing the response text,
      // status, and jqXHR object for each of the four ajax calls respectively.
      onSuccess(templates);
    });
  }

  loadLang(code,onSuccess){
    var self = this;
    $.getJSON("locales/"+code+".json",function(data){
      onSuccess(data);
    });
  }

  setContent(div,type){
    if(type === "#movies"){
      this.moviesMgr.render(div);
    }else if(type === "#series"){
      this.seriesMgr.renderSeries(div);
    }else if(type === "#addserie"){
      this.addVideoMgr.render(div,"serie");
    }else if(type === "#addmovie"){
      this.addVideoMgr.render(div,"movie");
    }else if(type.substr(0,6) === "#serie" && type.length > 7){//#media_id
      //Extract id
      var serieId = parseInt(type.substr(7));
      this.serieMgr.render(div,serieId);
      //this.updateProgressions();
    }else if(type.substr(0,6) === "#movie" && type.length > 7){//#media_id
      //Extract id
      var mediaId = parseInt(type.substr(7));
      this.movieMgr.render(div,mediaId);
      //this.updateProgressions();
    }else if(type === "#workers"){
      this.workersMgr.render(div)
    }else if(type === "#transcoding"){
      this.transcodingMgr.render(div)
    }else if(type.substr(0,13) === "#mediacontent"){
      this.mediaContentMgr.render(div)
    }else{
      $(div).html("<div id=\"\">Work in progress</div>");
      //this.emptyMgr.render(div);
      console.error("Not implemented hash ", type);
    }
  }

  start(){
    var self = this;
    jQuery(document).ready(function () {
        $('#sidebarCollapse').on('click', function () {
            $('#sidebar').toggleClass('active');
            $(this).toggleClass('active');
        });
    });
    
    // Setup content
    //var contentMgr = new ContentManager();
    this.load("en",()=>{
        if(location.hash.length > 0){
          self.setContent("#content",location.hash);
        }else{
          self.setContent("#content","#movies");
        }
    });

    // Catch hash changes
    window.addEventListener("hashchange", function () {
            console.log("hash changed ",location.hash);
            self.setContent("#content",location.hash);
        }, false);
        
    // Just make last selected element a bit darker
    $('.nav-elems li').click(function(e) {
      $('.nav-elems li').removeClass('active');
      var $this = $(this);
      if (!$this.hasClass('active')) {
        $this.addClass('active');
      }
    });
    
    // TVDBKey
    theMovieDb.common.initialize();
  }
}

//Main entry point
var contentManager = new ContentManager();
contentManager.start();
