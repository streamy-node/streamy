class VideoBlock{
    constructor(){
        this.droppedFiles = null;
    }

    /**
     * @param {*} element element containing a box 
     * @param {*} type serie or films
     * @param {*} id episode id or film id
     */
    setup(element){
        var self = this;
        var $form = element.find('.box');

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