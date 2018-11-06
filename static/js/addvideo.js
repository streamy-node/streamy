class AddVideoConstroller{
    constructor(templates){
        this.templates = templates;
    }

    initialize(){
        //Nothing to initialize for now
    }

    render(div,type){
        this.div = div;
        if(!this.isInitialized){
            this.initialize();
            this.isInitialized = true;
        }

        var self = this;
        $(div).html(this.templates.addvideo);
        this.setup(type)
    }

    setup(type){
        // Setup search mechanism
        var searchResults = null;
        var videoInfos = null;

        //On title selection update displayed infos
        var onTitleSelection = function(selectedIndex){
            if(searchResults){
                // Update fields
                videoInfos = searchResults["results"][selectedIndex];
            
                if(type == "serie"){
                    $("#releasedate").text(videoInfos.first_air_date);
                }else{
                    $("#releasedate").text(videoInfos.release_date);
                }
                $("#rating").text(videoInfos.vote_average);
                $("#ratingcount").text(videoInfos.vote_count);
                $("#overview").text(videoInfos.overview);
                $("#poster").attr("src",theMovieDb.common.images_uri+"original"+videoInfos.poster_path);
            }
        };

        var serieSearch = new Autocomplete(document.getElementById("titleName"),[],true,onTitleSelection);
        var bufferedSearch = new BufferedSearch(function(inputData){
            if(inputData.length > 1){
                // Initialize
                var getter =null;
                if(type == "serie"){
                    getter = theMovieDb.search.getTv;
                }else if(type == "movie"){
                    getter = theMovieDb.search.getMovie;
                }else{
                    console.error("Unknown addvideo type");
                    return;
                }

                getter({"query":inputData}, 
                    function(jsonData){
                        searchResults = JSON.parse(jsonData);
                        let titles = [];
                        for(var i=0; i<8 && i<searchResults["results"].length;i++ ){
                            if(type == "serie"){
                                titles.push(searchResults["results"][i].name);   
                            }else{
                                titles.push(searchResults["results"][i].title);   
                            }
                            
                        }
                        console.log("Found ",titles,document.getElementById("titleName"))
                        serieSearch.updateArray(titles);
                    },
                    function(data){
                        console.log("Failed seraching ",data);
                    }
                );
            }
        });

        $('#titleName').on('input', function() {
            bufferedSearch.doSearch($(this).val());
        });
    
        //Connect buttons
        $("#addtitle").click(function(){
            var data = {moviedbId:videoInfos.id};
            if(type == "serie"){
                postAsJson(data,"/series", function(response){
                    window.location.hash = "#serie_"+response.id.toString();
                },function(response){
                    alert("Failed to add serie "+response);
                })
            }else if(type == "movie"){
                postAsJson(data,"/movies", function(response){
                    window.location.hash = "#movie_"+response.id.toString();
                },function(response){
                    alert("Failed to add movie "+response);
                })
            }
        });
    }
}