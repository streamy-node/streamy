class SettingsController extends ContentController{
    constructor(templates){
        super()
        this.templates = templates;
        this.isInitialized = false;
        this.settings = {};
    }

    /**
     * @override
     */
    _render(div){
        var self = this;
        $(div).html(this.templates.settings);

        $.getJSON( "settings", function( settings ) {
            self.renderSettings(Object.entries(settings));
        });

        $("#save_settings").click(function(){
            postAsJson(self.settings,"/settings", function(){
                //TODO something like removeing save button
                    $.getJSON( "settings", function( settings ) {
                        self.renderSettings(Object.entries(settings));
                    });
                },function(response){
                    alert("Failed to update settings "+response);
                },false
            )
        });
    }

    renderSettings(settings){
        $("#settings_list").empty()
        for(var i=0; i<settings.length; i++){
            this.settings[settings[i][0]] = settings[i][1]
            this.appendSetting(settings[i]);
        } 
    }

    appendSetting(setting){
        this.appendToContainer("#settings_list",this.renderSetting(setting));
    }
    
    renderSetting(setting){
        var template = null;
        if(setting[0] == "new_video_brick" ||
        setting[0] == "upload_brick"){
            template = this.generateSelectBrickSetting(setting[0],setting[1])
        }
        if(setting[0] == "encoder_h264_profile"){
            template = this.generatePrefilledSetting(setting[0],'#setting_h264_profile_tpl',setting[1])
        }
        if(setting[0] == "encoder_h264_preset"){
            template = this.generatePrefilledSetting(setting[0],'#setting_h264_preset_tpl',setting[1])
        }
        if(setting[0] == "tmdb_api_key"){
            template = this.generateStringSetting(setting[0],'#setting_string_tpl',setting[1])
        }

        return template;
    }

    generateSelectBrickSetting(settingName, value){
        var self = this;
        var template = $("#setting_brick_select_tpl").clone();
        template.attr('id','');
        template.removeClass("hidden");
        template.find(".label").text(settingName);
        let listElem = template.find(".options_list");
        listElem.val(value);

        //Fetch bricks
        $.getJSON( "bricks", function( bricks ) {
            for(let brick of bricks){
                listElem.append(
                    $('<option></option>').val(brick.id).html(brick.brick_path)
                );
            }
        });

        listElem.on('change',function(){
            self.settings[settingName] = listElem.val()
        })
        return template;
    }

    generatePrefilledSetting(settingName,templateId,defaultValue){
        var template = $(templateId).clone();
        template.attr('id','');
        template.removeClass("hidden");

        let listElem = template.find(".options_list");
        listElem.val(defaultValue);

        var self = this;
        listElem.on('change',function(){
            self.settings[settingName] = listElem.val()
        })

        return template;
    }

    generateStringSetting(settingName,templateId,defaultValue){
        var template = $(templateId).clone();
        template.attr('id','');
        template.removeClass("hidden");
        template.find(".label").text(settingName);

        let valElem = template.find(".string_val")
        //valElem.text(defaultValue);

        valElem.val(defaultValue);

        var self = this;
        valElem.on('change',function(){
            self.settings[settingName] = valElem.val()
        })

        return template;
    }
    
    appendToContainer(containerId,elem){
        $(containerId).first().append(elem);
    }    
}