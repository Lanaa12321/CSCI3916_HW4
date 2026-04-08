var mongoose = require('mongoose');
var bcrypt = require('bcrypt');

mongoose.Promise = global.Promise;

var Schema = mongoose.Schema;

var UserSchema = new Schema({
    username: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    }
});

UserSchema.pre('save', function (next) {
    var user = this;

    if (!user.isModified('password')) {
        return next();
    }

    bcrypt.hash(user.password, 10, function (err, hash) {
        if (err) {
            return next(err);
        }

        user.password = hash;
        next();
    });
});

UserSchema.methods.comparePassword = function (password, callback) {
    bcrypt.compare(password, this.password, function (err, isMatch) {
        if (err) {
            return callback(err, false);
        }

        return callback(null, isMatch);
    });
};

module.exports = mongoose.model('User', UserSchema);