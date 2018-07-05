CREATE TABLE `languages` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` char(49) CHARACTER SET utf8 DEFAULT NULL,
  `iso_639_1` char(2) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`iso_639_1`)
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

CREATE TABLE `videos_resolutions` (
  `id` int NOT NULL,
  `name` char(12) CHARACTER SET utf8,
  `ref_width` int NOT NULL,
  `ref_height` int NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`name`) 
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
    PRIMARY KEY (`id`),
    FOREIGN KEY (`season_id`) REFERENCES series_seasons(`id`) ON DELETE CASCADE,
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

CREATE TABLE `series_episodes_audio_langs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `episode_id` int NOT NULL,
  `lang_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`episode_id`) REFERENCES series_episodes(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`),
  CONSTRAINT UNIQUE (`episode_id`,`lang_id`) 
);

CREATE TABLE `series_episodes_srt_langs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `episode_id` int NOT NULL,
  `lang_id` int(10) unsigned  NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`episode_id`) REFERENCES series_episodes(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`),
  CONSTRAINT UNIQUE (`episode_id`,`lang_id`) 
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

CREATE TABLE `films_audio_langs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `film_id` int NOT NULL,
  `lang_id` int(10) unsigned  NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`film_id`) REFERENCES films(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`),
  CONSTRAINT UNIQUE (`film_id`,`lang_id`) 
);

CREATE TABLE `films_srt_langs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `film_id` int NOT NULL,
  `lang_id` int(10) unsigned  NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`film_id`) REFERENCES films(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`),
  CONSTRAINT UNIQUE (`film_id`,`lang_id`) 
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

CREATE TABLE `offline_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `command` VARCHAR(255) NOT NULL,
  `niceness` int NOT NULL,
  `args` VARCHAR(765) NOT NULL,
  `creation_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `working_dir` VARCHAR(255) NOT NULL,
  `output_files` VARCHAR(255) NOT NULL,
  `episode_id` int,
  `film_id` int,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`episode_id`) REFERENCES series_episodes(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`film_id`) REFERENCES films(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`working_dir`,`output_files`) 
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
) AUTO_INCREMENT=3 ;

-- INSERTIONS
INSERT INTO `value_types` VALUES(1, 'string');
INSERT INTO `value_types` VALUES(2, 'int');
INSERT INTO `value_types` VALUES(3, 'float');

INSERT INTO `global_settings` VALUES(1, 'new_video_brick', 2,NULL,NULL,NULL);
INSERT INTO `global_settings` VALUES(2, 'upload_brick', 2,NULL,NULL,NULL);

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

-- roles
INSERT INTO `roles` VALUES(1, 'admin');
INSERT INTO `roles` VALUES(2, 'user');
INSERT INTO `roles` VALUES(3, 'guest');

-- default user
INSERT INTO `users` (`username`,`password`,`role_id`,`qos_priority`) VALUES( 'admin', 'streamy',1,255);

-- dev
INSERT INTO `bricks` (`id`,`alias`,`path`) VALUES( 1, 'brick1','/data/streamy');
INSERT INTO `bricks` (`id`,`alias`,`path`) VALUES( 2, 'brick_upload','/data/upload');
UPDATE `global_settings` SET `int` = 1 WHERE `key` = 'new_video_brick' ;
UPDATE `global_settings` SET `int` = 2 WHERE `key` = 'upload_brick' ;