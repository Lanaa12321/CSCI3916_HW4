require('dotenv').config();

var passport = require('passport');
var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;
var User = require('./Users');

var opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme('jwt');
opts.secretOrKey = process.env.SECRET_KEY || 'development_secret_key';

passport.use(new JwtStrategy(opts, function (jwt_payload, done) {
    User.findById(jwt_payload.id, function (err, user) {
        if (err) {
            return done(err, false);
        }

        if (user) {
            return done(null, user);
        } else {
            return done(null, false);
        }
    });
}));

exports.isAuthenticated = passport.authenticate('jwt', { session: false });
exports.secret = opts.secretOrKey;
exports.passport = passport;