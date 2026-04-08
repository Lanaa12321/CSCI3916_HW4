var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var MovieSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    releaseDate: {
        type: String,
        required: true
    },
    genre: {
        type: String,
        required: true
    },
    actors: {
        type: [String],
        required: true
    }
});

module.exports = mongoose.model('Movie', MovieSchema);