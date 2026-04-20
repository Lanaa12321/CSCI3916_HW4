var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var MovieSchema = new Schema({
    title: {
        type: String,
        required: true,
        index: true
    },
    releaseDate: {
        type: Number,
        min: 1900,
        max: 2100,
        required: true
    },
    genre: {
        type: String,
        required: true
    },
    actors: {
        type: [String],
        required: true
    },
    imageUrl: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('Movie', MovieSchema);