class VideoBlock{
    constructor(){
        this.droppedFiles = null;
        this.getStreamsInfos = null;
        this.element = null;
    }

    launchVideo(mdpFile){
        var windowObjectReference = window.open("js/light-player/index.html?mdp="+encodeURIComponent(mdpFile), "streamy player");
    }

    setBroken(value){
        let $broken = this.element.find('.video_broken');
        if(!value){
            $broken.addClass('visible');
        }else{
            $broken.addClass('invisible');
        } 
    }

    onPlayClick(){
        var self = this;
        this.getStreamsInfos(function(results,dataPath){
            if(results.length == 1){
                let res = results[0];
                console.log("Result ",results[0],dataPath);
                self.launchVideo("/"+dataPath+"/"+res.mdp.folder+"/allsub.mpd");
                //var manifestUri = "http://192.168.1.69:80/videos/fftest/video1-bis.mpd"
            }else if(results.length > 0){
                alert("TODO open a window");
            }else{
                alert("No streams available");
            }
        });
    }

    /**
     * @param {*} element element containing a box 
     * @param {*} type serie or films
     * @param {*} id episode id or film id
     */
    setup(element){
        let self = this;
        self.element = element;
        let $form = element.find('.box');

        let blocs = $form.find('.bloc-image');
        //setup play
        $form.find('.bloc-image').click(function(){
            self.onPlayClick();
        });

        //Setup upload
        if (uploadUtils.isAdvancedUpload()) {
            $form.addClass('has-advanced-upload');
            this.droppedFiles = false;

            $form.on('drag dragstart dragend dragover dragenter dragleave drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
            })
            .on('dragover dragenter', function() {
                $form.addClass('is-dragover');
            })
            .on('dragleave dragend drop', function() {
                $form.removeClass('is-dragover');
            })
            .on('drop', function(e) {
                self.droppedFiles = e.originalEvent.dataTransfer.files;
                //showFiles( droppedFiles );
                $form.trigger('submit');
            });
    
        }else{
            // $input.on('change', function(e) { // when drag & drop is NOT supported
            //     $form.trigger('submit');
            // });
        }
    
        var $input = element.find('input[type="file"]'),
        $label = element.find('label'),
        showFiles = function(files) {
          $label.text(files.length > 1 ? ($input.attr('data-multiple-caption') || '').replace( '{count}', files.length ) : files[ 0 ].name);
        };
    
        $input.on('change', function(e) {
            $form.trigger('submit');
            //showFiles(e.target.files);
        });
    
        $form.on('submit', function(e) {
            if ($form.hasClass('is-uploading')) return false;
        
            $form.addClass('is-uploading').removeClass('is-error');
        
            if (uploadUtils.isAdvancedUpload()) {
            // ajax for modern browsers
                e.preventDefault();
    
                var ajaxData = new FormData($form.get(0));
                ajaxData.append("id",$form.attr('video_id') );
    
                if (self.droppedFiles) {
                    $.each( self.droppedFiles, function(i, file) {
                        ajaxData.append( $input.attr('name'), file );
                    });
                }
    
                $.ajax({
                    url: $form.attr('action'),
                    type: $form.attr('method'),
                    data: ajaxData,
                    dataType: 'json',
                    cache: false,
                    contentType: false,
                    processData: false,
                    complete: function() {
                        $form.removeClass('is-uploading');
                    },
                    success: function(data) {
                        $form.addClass( data.success == true ? 'is-success' : 'is-error' );
                        if (!data.success) 
                            $errorMsg.text(data.error);
                    },
                    error: function() {
                    // Log the error, show an alert, whatever works for you
                    }
                });
            } else {
                // ajax for legacy browsers
                var iframeName  = 'uploadiframe' + new Date().getTime();
                $iframe   = $('<iframe name="' + iframeName + '" style="display: none;"></iframe>');
    
                $('body').append($iframe);
                $form.attr('target', iframeName);
    
                $iframe.one('load', function() {
                    var data = JSON.parse($iframe.contents().find('body' ).text());
                    $form
                    .removeClass('is-uploading')
                    .addClass(data.success == true ? 'is-success' : 'is-error')
                    .removeAttr('target');
                    if (!data.success) $errorMsg.text(data.error);
                    $form.removeAttr('target');
                    $iframe.remove();
                });
            }
        });
    }
}
// Based on https://css-tricks.com/drag-and-drop-file-uploading/


// var $form = $('.box');
//     if (uploadUtils.isAdvancedUpload()) {
//         $form.addClass('has-advanced-upload');
//         var droppedFiles = false;

//         $form.on('drag dragstart dragend dragover dragenter dragleave drop', function(e) {
//             e.preventDefault();
//             e.stopPropagation();
//         })
//         .on('dragover dragenter', function() {
//         $form.addClass('is-dragover');
//         })
//         .on('dragleave dragend drop', function() {
//         $form.removeClass('is-dragover');
//         })
//         .on('drop', function(e) {
//             droppedFiles = e.originalEvent.dataTransfer.files;
//             //showFiles( droppedFiles );
//             $form.trigger('submit');
//         });

//     }else{
//         $input.on('change', function(e) { // when drag & drop is NOT supported
//             $form.trigger('submit');
//         });
//     }

//     var $input    = $form.find('input[type="file"]'),
//     $label    = $form.find('label'),
//     showFiles = function(files) {
//       $label.text(files.length > 1 ? ($input.attr('data-multiple-caption') || '').replace( '{count}', files.length ) : files[ 0 ].name);
//     };

//     $input.on('change', function(e) {
//         showFiles(e.target.files);
//     });

//     $form.on('submit', function(e) {
//         if ($form.hasClass('is-uploading')) return false;
    
//         $form.addClass('is-uploading').removeClass('is-error');
    
//         if (uploadUtils.isAdvancedUpload()) {
//         // ajax for modern browsers
//             e.preventDefault();

//             var ajaxData = new FormData($form.get(0));
//             ajaxData.append("serieId",serieId );

//             if (droppedFiles) {
//                 $.each( droppedFiles, function(i, file) {
//                     ajaxData.append( $input.attr('name'), file );
//                 });
//             }

//             $.ajax({
//                 url: $form.attr('action'),
//                 type: $form.attr('method'),
//                 data: ajaxData,
//                 dataType: 'json',
//                 cache: false,
//                 contentType: false,
//                 processData: false,
//                 complete: function() {
//                     $form.removeClass('is-uploading');
//                 },
//                 success: function(data) {
//                     $form.addClass( data.success == true ? 'is-success' : 'is-error' );
//                     if (!data.success) 
//                         $errorMsg.text(data.error);
//                 },
//                 error: function() {
//                 // Log the error, show an alert, whatever works for you
//                 }
//             });
//         } else {
//             // ajax for legacy browsers
//             var iframeName  = 'uploadiframe' + new Date().getTime();
//             $iframe   = $('<iframe name="' + iframeName + '" style="display: none;"></iframe>');

//             $('body').append($iframe);
//             $form.attr('target', iframeName);

//             $iframe.one('load', function() {
//                 var data = JSON.parse($iframe.contents().find('body' ).text());
//                 $form
//                 .removeClass('is-uploading')
//                 .addClass(data.success == true ? 'is-success' : 'is-error')
//                 .removeAttr('target');
//                 if (!data.success) $errorMsg.text(data.error);
//                 $form.removeAttr('target');
//                 $iframe.remove();
//             });
//         }
//     });