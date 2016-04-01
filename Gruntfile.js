"use strict";

module.exports = function (grunt) {

    grunt.loadNpmTasks('grunt-apidoc');

    grunt.initConfig(
        {
            jshint: {
                all: ['Gruntfile.js', './lib/**/*.js', 'test/spec/**/*.js', 'test/integration/**/*.js'],
                options: {
                    jshintrc: '.jshintrc',
                    reporter: require('jshint-stylish')
                }
            },

            watch: {
                files: ['<%= jshint.files %>'],
                tasks: ['jshint']
            },

            mochaTest: {
                test: {
                    options: {
                        reporter: 'spec'
                    },
                    src: ['test/spec/**/*.js']
                }
            }
        }
    );

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.registerTask('lint', ['jshint']);
    grunt.registerTask('default', ['jshint', 'mochaTest']);
};