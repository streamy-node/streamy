CREATE TABLE `languages` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` char(49) CHARACTER SET utf8 DEFAULT NULL,
  `iso_639_1` char(2) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`iso_639_1`)
) DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=136 ;

-- ffmpeg use 639_2
CREATE TABLE `languages_iso_639_2` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `language_id` int(10) unsigned NOT NULL,
  `iso_639_2` char(3) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`iso_639_2`),
  FOREIGN KEY (`language_id`) REFERENCES languages(`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=136 ;

-- IETF language
CREATE TABLE `languages_subtags` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `language_id` int(10) unsigned NOT NULL,
  `subtag` char(4) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`language_id`,`subtag` )
) DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=136 ;

CREATE TABLE `genres` (
  `id` int NOT NULL,
  `default_name` char(49) CHARACTER SET utf8 NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `bricks` (
  `id` int NOT NULL,
  `alias` char(49) CHARACTER SET utf8 NOT NULL,
  `path` VARCHAR(255),
  PRIMARY KEY (`id`)
);

CREATE TABLE `resolutions` (
  `id` int NOT NULL,
  `name` varchar(50) NOT NULL,
  `width` int NOT NULL,
  `height` int NOT NULL,
   PRIMARY KEY (`id`),
   CONSTRAINT UNIQUE (`name`),
   CONSTRAINT UNIQUE (`width`) 
);

CREATE TABLE `resolutions_bitrates` (
  `id` int NOT NULL,
  `resolution_id` int NOT NULL,
  `bitrate` int NOT NULL,
   PRIMARY KEY (`id`),
   CONSTRAINT UNIQUE (`resolution_id`),
   FOREIGN KEY (`resolution_id`) REFERENCES resolutions(`id`) ON DELETE CASCADE
);

CREATE TABLE `audio_bitrates` (
  `id` int NOT NULL,
  `name` varchar(50) NOT NULL,
  `channels` int NOT NULL,
  `bitrate` int NOT NULL,
   PRIMARY KEY (`id`),
   CONSTRAINT UNIQUE (`name`),
   CONSTRAINT UNIQUE (`channels`)
);

CREATE TABLE `genres_moviedb` (
  `id` int NOT NULL,
  `genre_id` int NOT NULL,
  `moviedb_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`genre_id`) REFERENCES genres(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`genre_id`,`moviedb_id`)
);

CREATE TABLE `genres_translations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `genre_id` int NOT NULL,
  `lang_id` int(10) unsigned NOT NULL,
  `name` char(49) CHARACTER SET utf8 NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`genre_id`) REFERENCES genres(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`) ON DELETE CASCADE 
);

CREATE TABLE `series` (
  `id` int NOT NULL AUTO_INCREMENT,
  `release_date` datetime NOT NULL,
  `rating` decimal(3,1) DEFAULT '0.0',
  `rating_count` int UNSIGNED DEFAULT '0',
  `number_of_seasons` TINYINT UNSIGNED,
  `number_of_episodes` INT UNSIGNED,
  `original_name` VARCHAR(255) NOT NULL,
  `original_language` char(2) CHARACTER SET utf8 NOT NULL,
  `brick_id` int,
  `added_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `has_mpd` TINYINT(2) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`original_language`) REFERENCES languages(`iso_639_1`),
  FOREIGN KEY (`brick_id`) REFERENCES bricks(`id`),
  CONSTRAINT UNIQUE (`release_date`,`original_name`)
);

CREATE TABLE `series_translations` (
    `id` int NOT NULL AUTO_INCREMENT,
    `serie_id` int NOT NULL,
    `lang_id` int(10) unsigned NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `overview` VARCHAR(765),
    PRIMARY KEY (`id`),
    FOREIGN KEY (`serie_id`) REFERENCES series(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`lang_id`) REFERENCES languages(`id`)
);

CREATE TABLE `series_genres` (
  `id` int NOT NULL AUTO_INCREMENT,
  `serie_id` int NOT NULL,
  `genre_id` int NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`serie_id`,`genre_id`) 
);

CREATE TABLE `series_moviedb` (
  `id` int NOT NULL AUTO_INCREMENT,
  `serie_id` int NOT NULL,
  `moviedb_id` int NOT NULL,
  `poster_path` VARCHAR(255),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`serie_id`) REFERENCES series(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`moviedb_id`)
);

CREATE TABLE `series_seasons` (
    `id` int NOT NULL AUTO_INCREMENT,
    `serie_id` int NOT NULL,
    `release_date` datetime NOT NULL,
    `season_number` int NOT NULL,
    `number_of_episodes` int NOT NULL,
    `added_date` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`serie_id`) REFERENCES series(`id`) ON DELETE CASCADE,
    CONSTRAINT UNIQUE (`serie_id`,`season_number`) 
);

CREATE TABLE `series_seasons_translations` (
    `id` int NOT NULL AUTO_INCREMENT,
    `season_id` int NOT NULL,
    `lang_id` int(10) unsigned NOT NULL,
    `title` VARCHAR(255),
    `overview` VARCHAR(765),
    PRIMARY KEY (`id`),
    FOREIGN KEY (`season_id`) REFERENCES series_seasons(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`lang_id`) REFERENCES languages(`id`)
);

CREATE TABLE `series_seasons_moviedb` (
  `id` int NOT NULL AUTO_INCREMENT,
  `season_id` int NOT NULL,
  `moviedb_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`season_id`) REFERENCES series_seasons(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`moviedb_id`)
);

CREATE TABLE `series_episodes` (
    `id` int NOT NULL AUTO_INCREMENT,
    `season_id` int NOT NULL,
    `episode_number` int NOT NULL,
    `original_name` VARCHAR(255),
    `release_date` datetime,
    `rating` decimal(3,1) DEFAULT '0.0',
    `rating_count` int UNSIGNED DEFAULT '0',
    `added_date` datetime DEFAULT CURRENT_TIMESTAMP,
    `best_resolution_id` int,
    `has_mpd` TINYINT(2) NOT NULL,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`season_id`) REFERENCES series_seasons(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`best_resolution_id`) REFERENCES resolutions(`id`),
    CONSTRAINT UNIQUE (`season_id`,`episode_number`) 
);

CREATE TABLE `series_episodes_translations` (
    `id` int NOT NULL AUTO_INCREMENT,
    `episode_id` int NOT NULL,
    `lang_id` int(10) unsigned NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `overview` VARCHAR(765),
    PRIMARY KEY (`id`),
    FOREIGN KEY (`episode_id`) REFERENCES series_episodes(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`lang_id`) REFERENCES languages(`id`)
);


CREATE TABLE `series_episodes_moviedb` (
  `id` int NOT NULL AUTO_INCREMENT,
  `episode_id` int NOT NULL,
  `moviedb_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`episode_id`) REFERENCES series_episodes(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`moviedb_id`)
);

CREATE TABLE `series_episodes_genres` (
  `id` int NOT NULL AUTO_INCREMENT,
  `episode_id` int NOT NULL,
  `genre_id` int NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`episode_id`,`genre_id`) 
);

CREATE TABLE `series_mpd_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `episode_id` int NOT NULL,
  `folder` VARCHAR(255) NOT NULL,
  `complete` TINYINT(2) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`episode_id`) REFERENCES series_episodes(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`episode_id`,`folder`) 
);

CREATE TABLE `series_videos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mpd_id` int NOT NULL,
  `resolution_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`mpd_id`) REFERENCES series_mpd_files(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`resolution_id`) REFERENCES resolutions(`id`)
);

CREATE TABLE `series_audios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mpd_id` int NOT NULL,
  `lang_id` int(10) unsigned,
  `lang_subtag_id` int(10) unsigned,
  `channels` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`mpd_id`) REFERENCES series_mpd_files(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`),
  CONSTRAINT UNIQUE (`mpd_id`,`lang_id`,`channels`) 
);

CREATE TABLE `series_srts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mpd_id` int NOT NULL,
  `lang_id` int(10) unsigned,
  `lang_subtag_id` int(10) unsigned,
  `name` VARCHAR(255),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`mpd_id`) REFERENCES series_mpd_files(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`)
);

CREATE TABLE `films` (
  `id` int NOT NULL AUTO_INCREMENT,
  `release_date` datetime NOT NULL,
  `rating` decimal(3,1) DEFAULT '0.0',
  `rating_count` int UNSIGNED DEFAULT '0',
  `original_name` VARCHAR(255),
  `original_language` char(2) CHARACTER SET utf8 NOT NULL,
  `brick_id` int,
  `added_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`original_language`) REFERENCES languages(`iso_639_1`),
  FOREIGN KEY (`brick_id`) REFERENCES bricks(`id`),
  CONSTRAINT UNIQUE (`original_name`,`release_date`) 
);

CREATE TABLE `films_translations` (
    `id` int NOT NULL AUTO_INCREMENT,
    `film_id` int NOT NULL,
    `lang_id` int(10) unsigned NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `overview` VARCHAR(765),
    PRIMARY KEY (`id`),
    FOREIGN KEY (`film_id`) REFERENCES films(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`lang_id`) REFERENCES languages(`id`),
    CONSTRAINT UNIQUE (`film_id`,`lang_id`) 
);

CREATE TABLE `films_genres` (
  `id` int NOT NULL AUTO_INCREMENT,
  `film_id` int NOT NULL,
  `genre_id` int NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`film_id`,`genre_id`) 
);

CREATE TABLE `films_mpd_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `film_id` int NOT NULL,
  `folder` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`film_id`) REFERENCES films(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`film_id`,`folder`) 
);

CREATE TABLE `films_videos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mpd_id` int NOT NULL,
  `resolution_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`mpd_id`) REFERENCES films_mpd_files(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`resolution_id`) REFERENCES resolutions(`id`)
);

CREATE TABLE `films_audios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mpd_id` int NOT NULL,
  `lang_id` int(10) unsigned,
  `lang_subtag_id` int(10) unsigned,
  `channels` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`mpd_id`) REFERENCES films_mpd_files(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`),
  CONSTRAINT UNIQUE (`mpd_id`,`lang_id`,`channels`) 
);

CREATE TABLE `films_srts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mpd_id` int NOT NULL,
  `lang_id` int(10) unsigned  NOT NULL,
  `lang_subtag_id` int(10) unsigned,
  `name` VARCHAR(255),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`mpd_id`) REFERENCES films_mpd_files(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`)
);

CREATE TABLE `films_moviedb` (
  `id` int NOT NULL AUTO_INCREMENT,
  `films_id` int NOT NULL,
  `moviedb_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`films_id`) REFERENCES films(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`moviedb_id`)
);

CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role_id` int NOT NULL,
  `qos_priority` TINYINT UNSIGNED NOT NULL,
  `last_connection` datetime,
  `email` VARCHAR(255),
  `phone` VARCHAR(255),
  `added_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`role_id`) REFERENCES roles(`id`),
  CONSTRAINT UNIQUE (`username`) 
);

CREATE TABLE `users_films` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `film_id` int NOT NULL,
  `watched` TINYINT(1) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES users(`id`),
  FOREIGN KEY (`film_id`) REFERENCES films(`id`),
  CONSTRAINT UNIQUE (`user_id`,`film_id`) 
);

CREATE TABLE `users_series` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `serie_id` int NOT NULL,
  `watched_season` int DEFAULT 0,
  `watched_episode` int DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES users(`id`),
  FOREIGN KEY (`serie_id`) REFERENCES series(`id`),
  CONSTRAINT UNIQUE (`user_id`,`serie_id`) 
);

CREATE TABLE `users_films_progressions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `film_id` int NOT NULL,
  `audio_lang` int,
  `subtitle_lang` int,
  `progression` float DEFAULT '0.0',
  `last_seen` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES users(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`film_id`) REFERENCES films(`id`)
);

CREATE TABLE `users_episodes_progressions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `episode_id` int NOT NULL,
  `audio_lang` int,
  `subtitle_lang` int,
  `progression` float DEFAULT '0.0',
  `last_seen` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES users(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`episode_id`) REFERENCES series_episodes(`id`)
);

CREATE TABLE `add_file_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creation_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `file` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `working_folder` VARCHAR(255) NOT NULL,
  `episode_id` int,
  `film_id` int,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`episode_id`) REFERENCES series_episodes(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`film_id`) REFERENCES films(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`file`) ,
  CONSTRAINT UNIQUE (`working_folder`) 
);

CREATE TABLE `add_file_subtasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `command` VARCHAR(2048) NOT NULL,
  `output` VARCHAR(255) NOT NULL,
  `done` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`task_id`) REFERENCES add_file_tasks(`id`) ON DELETE CASCADE
);

CREATE TABLE `users_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `interface_lang` int(10) UNSIGNED DEFAULT 1,
  `audio_lang` int(10) UNSIGNED DEFAULT 0,
  `subtitle_lang` int(10) UNSIGNED DEFAULT 1,
  `subtitle_enabled` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES users(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`interface_lang`) REFERENCES languages(`id`),
  FOREIGN KEY (`audio_lang`) REFERENCES languages(`id`),
  FOREIGN KEY (`subtitle_lang`) REFERENCES languages(`id`)
);

CREATE TABLE `series_transcoding_resolutions` (
  `id` int NOT NULL,
  `resolution_id` int NOT NULL,
   PRIMARY KEY (`id`),
   FOREIGN KEY (`resolution_id`) REFERENCES resolutions(`id`) ON DELETE CASCADE,
   CONSTRAINT UNIQUE (`resolution_id`)
);

CREATE TABLE `films_transcoding_resolutions` (
  `id` int NOT NULL,
  `resolution_id` int NOT NULL,
   PRIMARY KEY (`id`),
   FOREIGN KEY (`resolution_id`) REFERENCES resolutions(`id`) ON DELETE CASCADE,
   CONSTRAINT UNIQUE (`resolution_id`)
);

CREATE TABLE `ffmpeg_workers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ipv4` INT UNSIGNED NOT NULL,
  `port` INT UNSIGNED NOT NULL,
  `enabled` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`ipv4`,`port`)
);

CREATE TABLE `value_types` (
  `id` int NOT NULL,
  `setting_type` varchar(50) NOT NULL,
   PRIMARY KEY (`id`)
);

CREATE TABLE `global_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(50),
  `type` int,
  `string` varchar(50),
  `int` int,
  `float` float,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`type`) REFERENCES value_types(`id`)
) AUTO_INCREMENT=10 ;

-- INSERTIONS
INSERT INTO `value_types` VALUES(1, 'string');
INSERT INTO `value_types` VALUES(2, 'int');
INSERT INTO `value_types` VALUES(3, 'float');

INSERT INTO `global_settings` VALUES(1, 'new_video_brick', 2,NULL,NULL,NULL);
INSERT INTO `global_settings` VALUES(2, 'upload_brick', 2,NULL,NULL,NULL);
INSERT INTO `global_settings` VALUES(3, 'segment_duration', 2,NULL,2,NULL);
INSERT INTO `global_settings` VALUES(5, 'encoder_h264_profile', 1,"main",NULL,NULL);
INSERT INTO `global_settings` VALUES(6, 'encoder_h264_preset', 1,"slow",NULL,NULL);

-- Languages --
INSERT INTO `languages` VALUES(0, 'Native', NULL);
INSERT INTO `languages` VALUES(1, 'English', 'en');
INSERT INTO `languages` VALUES(2, 'Afar', 'aa');
INSERT INTO `languages` VALUES(3, 'Abkhazian', 'ab');
INSERT INTO `languages` VALUES(4, 'Afrikaans', 'af');
INSERT INTO `languages` VALUES(5, 'Amharic', 'am');
INSERT INTO `languages` VALUES(6, 'Arabic', 'ar');
INSERT INTO `languages` VALUES(7, 'Assamese', 'as');
INSERT INTO `languages` VALUES(8, 'Aymara', 'ay');
INSERT INTO `languages` VALUES(9, 'Azerbaijani', 'az');
INSERT INTO `languages` VALUES(10, 'Bashkir', 'ba');
INSERT INTO `languages` VALUES(11, 'Belarusian', 'be');
INSERT INTO `languages` VALUES(12, 'Bulgarian', 'bg');
INSERT INTO `languages` VALUES(13, 'Bihari', 'bh');
INSERT INTO `languages` VALUES(14, 'Bislama', 'bi');
INSERT INTO `languages` VALUES(15, 'Bengali/Bangla', 'bn');
INSERT INTO `languages` VALUES(16, 'Tibetan', 'bo');
INSERT INTO `languages` VALUES(17, 'Breton', 'br');
INSERT INTO `languages` VALUES(18, 'Catalan', 'ca');
INSERT INTO `languages` VALUES(19, 'Corsican', 'co');
INSERT INTO `languages` VALUES(20, 'Czech', 'cs');
INSERT INTO `languages` VALUES(21, 'Welsh', 'cy');
INSERT INTO `languages` VALUES(22, 'Danish', 'da');
INSERT INTO `languages` VALUES(23, 'German', 'de');
INSERT INTO `languages` VALUES(24, 'Bhutani', 'dz');
INSERT INTO `languages` VALUES(25, 'Greek', 'el');
INSERT INTO `languages` VALUES(26, 'Esperanto', 'eo');
INSERT INTO `languages` VALUES(27, 'Spanish', 'es');
INSERT INTO `languages` VALUES(28, 'Estonian', 'et');
INSERT INTO `languages` VALUES(29, 'Basque', 'eu');
INSERT INTO `languages` VALUES(30, 'Persian', 'fa');
INSERT INTO `languages` VALUES(31, 'Finnish', 'fi');
INSERT INTO `languages` VALUES(32, 'Fiji', 'fj');
INSERT INTO `languages` VALUES(33, 'Faeroese', 'fo');
INSERT INTO `languages` VALUES(34, 'French', 'fr');
INSERT INTO `languages` VALUES(35, 'Frisian', 'fy');
INSERT INTO `languages` VALUES(36, 'Irish', 'ga');
INSERT INTO `languages` VALUES(37, 'Scots/Gaelic', 'gd');
INSERT INTO `languages` VALUES(38, 'Galician', 'gl');
INSERT INTO `languages` VALUES(39, 'Guarani', 'gn');
INSERT INTO `languages` VALUES(40, 'Gujarati', 'gu');
INSERT INTO `languages` VALUES(41, 'Hausa', 'ha');
INSERT INTO `languages` VALUES(42, 'Hindi', 'hi');
INSERT INTO `languages` VALUES(43, 'Croatian', 'hr');
INSERT INTO `languages` VALUES(44, 'Hungarian', 'hu');
INSERT INTO `languages` VALUES(45, 'Armenian', 'hy');
INSERT INTO `languages` VALUES(46, 'Interlingua', 'ia');
INSERT INTO `languages` VALUES(47, 'Interlingue', 'ie');
INSERT INTO `languages` VALUES(48, 'Inupiak', 'ik');
INSERT INTO `languages` VALUES(49, 'Indonesian', 'in');
INSERT INTO `languages` VALUES(50, 'Icelandic', 'is');
INSERT INTO `languages` VALUES(51, 'Italian', 'it');
INSERT INTO `languages` VALUES(52, 'Hebrew', 'iw');
INSERT INTO `languages` VALUES(53, 'Japanese', 'ja');
INSERT INTO `languages` VALUES(54, 'Yiddish', 'ji');
INSERT INTO `languages` VALUES(55, 'Javanese', 'jw');
INSERT INTO `languages` VALUES(56, 'Georgian', 'ka');
INSERT INTO `languages` VALUES(57, 'Kazakh', 'kk');
INSERT INTO `languages` VALUES(58, 'Greenlandic', 'kl');
INSERT INTO `languages` VALUES(59, 'Cambodian', 'km');
INSERT INTO `languages` VALUES(60, 'Kannada', 'kn');
INSERT INTO `languages` VALUES(61, 'Korean', 'ko');
INSERT INTO `languages` VALUES(62, 'Kashmiri', 'ks');
INSERT INTO `languages` VALUES(63, 'Kurdish', 'ku');
INSERT INTO `languages` VALUES(64, 'Kirghiz', 'ky');
INSERT INTO `languages` VALUES(65, 'Latin', 'la');
INSERT INTO `languages` VALUES(66, 'Lingala', 'ln');
INSERT INTO `languages` VALUES(67, 'Laothian', 'lo');
INSERT INTO `languages` VALUES(68, 'Lithuanian', 'lt');
INSERT INTO `languages` VALUES(69, 'Latvian/Lettish', 'lv');
INSERT INTO `languages` VALUES(70, 'Malagasy', 'mg');
INSERT INTO `languages` VALUES(71, 'Maori', 'mi');
INSERT INTO `languages` VALUES(72, 'Macedonian', 'mk');
INSERT INTO `languages` VALUES(73, 'Malayalam', 'ml');
INSERT INTO `languages` VALUES(74, 'Mongolian', 'mn');
INSERT INTO `languages` VALUES(75, 'Moldavian', 'mo');
INSERT INTO `languages` VALUES(76, 'Marathi', 'mr');
INSERT INTO `languages` VALUES(77, 'Malay', 'ms');
INSERT INTO `languages` VALUES(78, 'Maltese', 'mt');
INSERT INTO `languages` VALUES(79, 'Burmese', 'my');
INSERT INTO `languages` VALUES(80, 'Nauru', 'na');
INSERT INTO `languages` VALUES(81, 'Nepali', 'ne');
INSERT INTO `languages` VALUES(82, 'Dutch', 'nl');
INSERT INTO `languages` VALUES(83, 'Norwegian', 'no');
INSERT INTO `languages` VALUES(84, 'Occitan', 'oc');
INSERT INTO `languages` VALUES(85, '(Afan)/Oromoor/Oriya', 'om');
INSERT INTO `languages` VALUES(86, 'Punjabi', 'pa');
INSERT INTO `languages` VALUES(87, 'Polish', 'pl');
INSERT INTO `languages` VALUES(88, 'Pashto/Pushto', 'ps');
INSERT INTO `languages` VALUES(89, 'Portuguese', 'pt');
INSERT INTO `languages` VALUES(90, 'Quechua', 'qu');
INSERT INTO `languages` VALUES(91, 'Rhaeto-Romance', 'rm');
INSERT INTO `languages` VALUES(92, 'Kirundi', 'rn');
INSERT INTO `languages` VALUES(93, 'Romanian', 'ro');
INSERT INTO `languages` VALUES(94, 'Russian', 'ru');
INSERT INTO `languages` VALUES(95, 'Kinyarwanda', 'rw');
INSERT INTO `languages` VALUES(96, 'Sanskrit', 'sa');
INSERT INTO `languages` VALUES(97, 'Sindhi', 'sd');
INSERT INTO `languages` VALUES(98, 'Sangro', 'sg');
INSERT INTO `languages` VALUES(99, 'Serbo-Croatian', 'sh');
INSERT INTO `languages` VALUES(100, 'Singhalese', 'si');
INSERT INTO `languages` VALUES(101, 'Slovak', 'sk');
INSERT INTO `languages` VALUES(102, 'Slovenian', 'sl');
INSERT INTO `languages` VALUES(103, 'Samoan', 'sm');
INSERT INTO `languages` VALUES(104, 'Shona', 'sn');
INSERT INTO `languages` VALUES(105, 'Somali', 'so');
INSERT INTO `languages` VALUES(106, 'Albanian', 'sq');
INSERT INTO `languages` VALUES(107, 'Serbian', 'sr');
INSERT INTO `languages` VALUES(108, 'Siswati', 'ss');
INSERT INTO `languages` VALUES(109, 'Sesotho', 'st');
INSERT INTO `languages` VALUES(110, 'Sundanese', 'su');
INSERT INTO `languages` VALUES(111, 'Swedish', 'sv');
INSERT INTO `languages` VALUES(112, 'Swahili', 'sw');
INSERT INTO `languages` VALUES(113, 'Tamil', 'ta');
INSERT INTO `languages` VALUES(114, 'Telugu', 'te');
INSERT INTO `languages` VALUES(115, 'Tajik', 'tg');
INSERT INTO `languages` VALUES(116, 'Thai', 'th');
INSERT INTO `languages` VALUES(117, 'Tigrinya', 'ti');
INSERT INTO `languages` VALUES(118, 'Turkmen', 'tk');
INSERT INTO `languages` VALUES(119, 'Tagalog', 'tl');
INSERT INTO `languages` VALUES(120, 'Setswana', 'tn');
INSERT INTO `languages` VALUES(121, 'Tonga', 'to');
INSERT INTO `languages` VALUES(122, 'Turkish', 'tr');
INSERT INTO `languages` VALUES(123, 'Tsonga', 'ts');
INSERT INTO `languages` VALUES(124, 'Tatar', 'tt');
INSERT INTO `languages` VALUES(125, 'Twi', 'tw');
INSERT INTO `languages` VALUES(126, 'Ukrainian', 'uk');
INSERT INTO `languages` VALUES(127, 'Urdu', 'ur');
INSERT INTO `languages` VALUES(128, 'Uzbek', 'uz');
INSERT INTO `languages` VALUES(129, 'Vietnamese', 'vi');
INSERT INTO `languages` VALUES(130, 'Volapuk', 'vo');
INSERT INTO `languages` VALUES(131, 'Wolof', 'wo');
INSERT INTO `languages` VALUES(132, 'Xhosa', 'xh');
INSERT INTO `languages` VALUES(133, 'Yoruba', 'yo');
INSERT INTO `languages` VALUES(134, 'Chinese', 'zh');
INSERT INTO `languages` VALUES(135, 'Zulu', 'zu');


INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(1, 'eng');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(2, 'aar');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(3, 'abk');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(4, 'afr');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(5, 'amh');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(6, 'ara');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(7, 'asm');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(8, 'aym');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(9, 'aze');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(10, 'bak');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(11, 'bel');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(12, 'bul');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(13, 'bih');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(14, 'bis');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(15, 'ben');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(16, 'bod');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(16, 'tib');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(17, 'bre');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(18, 'cat');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(19, 'cos');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(20, 'ces');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(20, 'cze');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(21, 'cym');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(21, 'wel');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(22, 'dan');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(23, 'deu');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(23, 'ger');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(24, 'dzo');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(25, 'ell');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(25, 'gre');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(26, 'epo');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(27, 'spa');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(28, 'est');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(29, 'eus');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(29, 'baq');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(30, 'fas');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(30, 'per');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(31, 'fin');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(32, 'fij');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(33, 'fao');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(34, 'fre');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(34, 'fra');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(35, 'fry');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(36, 'gle');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(37, 'gla');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(38, 'glg');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(39, 'grn');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(40, 'guj');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(41, 'hau');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(42, 'heb');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(43, 'hin');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(44, 'hr');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(45, 'hu');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(46, 'hy');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(46, 'ia');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(47, 'ie');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(48, 'ik');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(49, 'in');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(50, 'is');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(51, 'it');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(52, 'iw');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(53, 'ja');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(54, 'ji');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(55, 'jw');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(56, 'ka');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(57, 'kk');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(58, 'kl');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(59, 'km');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(60, 'kn');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(61, 'ko');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(62, 'ks');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(63, 'ku');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(64, 'ky');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(65, 'la');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(66, 'ln');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(67, 'lo');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(68, 'lt');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(69, 'lv');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(70, 'mg');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(71, 'mi');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(72, 'mk');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(73, 'ml');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(74, 'mn');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(75, 'mo');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(76, 'mr');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(77, 'ms');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(78, 'mt');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(79, 'my');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(80, 'na');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(81, 'ne');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(82, 'nl');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(83, 'no');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(84, 'oc');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(85, 'om');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(86, 'pa');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(87, 'pl');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(88, 'ps');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(89, 'pt');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(90, 'qu');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(91, 'rm');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(92, 'rn');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(93, 'ro');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(94, 'ru');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(95, 'rw');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(96, 'sa');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(97, 'sd');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(98, 'sg');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(99, 'sh');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(100, 'si');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(101, 'sk');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(102, 'sl');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(103, 'sm');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(104, 'sn');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(105, 'so');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(106, 'sq');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(107, 'sr');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(108, 'ss');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(109, 'st');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(110, 'su');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(111, 'sv');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(112, 'sw');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(113, 'ta');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(114, 'te');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(115, 'tg');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(116, 'th');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(117, 'ti');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(118, 'tk');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(119, 'tl');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(120, 'tn');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(121, 'to');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(122, 'tr');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(123, 'ts');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(124, 'tt');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(125, 'tw');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(126, 'uk');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(127, 'ur');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(128, 'uz');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(129, 'vi');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(130, 'vo');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(131, 'wo');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(132, 'xh');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(133, 'yo');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(134, 'zh');
INSERT INTO `languages_iso_639_2` (`language_id`,`iso_639_2`) VALUES(135, 'zu');

-- IETF langs ( TODO add them all)
-- French sub tags
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'BE');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'BF');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'BI');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'BJ');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'BL');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'CA');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'CD');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'CF');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'CG');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'CH');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'CI');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'CM');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'DJ');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'DZ');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'FR');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'GA');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'GF');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'GN');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'GP');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'GQ');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'HT');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'KM');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'LU');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'MA');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'MC');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'MF');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'MG');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'ML');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'MQ');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'MR');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'MU');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'NC');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'NE');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'PF');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'PM');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'RE');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'RW');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'SC');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'SN');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'SY');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'TD');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'TG');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'TN');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'VU');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'WF');
INSERT INTO `languages_subtags` (`language_id`,`subtag`) VALUES(34, 'YT');

-- roles
INSERT INTO `roles` VALUES(1, 'admin');
INSERT INTO `roles` VALUES(2, 'user');
INSERT INTO `roles` VALUES(3, 'guest');

-- default user
INSERT INTO `users` (`username`,`password`,`role_id`,`qos_priority`) VALUES( 'admin', 'streamy',1,255);

-- resolutions
INSERT INTO `resolutions` VALUES(1, 'LOW', 1,1);
INSERT INTO `resolutions` VALUES(2, 'SD', 720,576);
INSERT INTO `resolutions` VALUES(3, 'HD', 1280,720);
INSERT INTO `resolutions` VALUES(4, 'FHD', 1920,1080);
INSERT INTO `resolutions` VALUES(5, 'UHD', 3840,2160);
INSERT INTO `resolutions` VALUES(6, '4K', 4096,2160);

INSERT INTO `resolutions_bitrates` VALUES(1, 1,800);
INSERT INTO `resolutions_bitrates` VALUES(2, 2,1200);
INSERT INTO `resolutions_bitrates` VALUES(3, 3,2400);
INSERT INTO `resolutions_bitrates` VALUES(4, 4,4800);
INSERT INTO `resolutions_bitrates` VALUES(5, 5,16000);
INSERT INTO `resolutions_bitrates` VALUES(6, 6,16000);

INSERT INTO `audio_bitrates` VALUES(1, 'Mono', 1, 128);
INSERT INTO `audio_bitrates` VALUES(2, 'Stereo', 2, 384);
INSERT INTO `audio_bitrates` VALUES(3, '2.1', 3, 384);
INSERT INTO `audio_bitrates` VALUES(4, '5.1', 6, 512);


-- transcoding resolutions
INSERT INTO `films_transcoding_resolutions` VALUES(1, 4);
INSERT INTO `films_transcoding_resolutions` VALUES(2, 3);

INSERT INTO `series_transcoding_resolutions` VALUES(1, 4);
INSERT INTO `series_transcoding_resolutions` VALUES(2, 3);

-- dev
INSERT INTO `bricks` (`id`,`alias`,`path`) VALUES( 1, 'brick1','/data/streamy');
INSERT INTO `bricks` (`id`,`alias`,`path`) VALUES( 2, 'brick_upload','/data/upload');
UPDATE `global_settings` SET `int` = 1 WHERE `key` = 'new_video_brick' ;
UPDATE `global_settings` SET `int` = 2 WHERE `key` = 'upload_brick' ;
INSERT INTO `ffmpeg_workers` (`ipv4`,`port`,`enabled`) VALUES (INET_ATON("127.0.0.1"),7000,1);
