require('dotenv').config();

var express = require('express');
var mongoose = require('mongoose');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var https = require('https');

var authJwtController = require('./auth_jwt');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');

var app = express();
var router = express.Router();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(function () {
    console.log('MongoDB connected');
})
.catch(function (err) {
    console.log('MongoDB connection error:', err.message);
});

function handleServerError(res, err) {
    return res.status(500).json({
        success: false,
        message: err.message || err
    });
}

function trackReviewEvent(movie, req) {
    if (!process.env.GA_KEY || !movie) {
        return;
    }

    var params = new URLSearchParams({
        v: '1',
        tid: process.env.GA_KEY,
        cid: Math.random().toString(36).substring(2) + Date.now(),
        t: 'event',
        ec: movie.genre || 'Unknown',
        ea: req.method + ' ' + req.route.path,
        el: 'API Request for Movie Review',
        ev: '1',
        cd1: movie.title,
        cm1: '1'
    });

    https.get('https://www.google-analytics.com/collect?' + params.toString(), function (response) {
        response.resume();
    }).on('error', function (error) {
        console.log('Google Analytics tracking failed:', error.message);
    });
}

/*
    SIGNUP
*/
router.post('/signup', function (req, res) {
    if (!req.body.name || !req.body.username || !req.body.password) {
        return res.status(400).json({
            success: false,
            msg: 'Please include name, username, and password to signup.'
        });
    }

    User.findOne({ username: req.body.username }, function (err, user) {
        if (err) {
            return handleServerError(res, err);
        }

        if (user) {
            return res.status(409).json({
                success: false,
                msg: 'Username already exists.'
            });
        }

        var newUser = new User({
            name: req.body.name,
            username: req.body.username,
            password: req.body.password
        });

        newUser.save(function (saveErr) {
            if (saveErr) {
                return handleServerError(res, saveErr);
            }

            return res.status(201).json({
                success: true,
                msg: 'Successfully created new user.'
            });
        });
    });
});

/*
    SIGNIN
*/
router.post('/signin', function (req, res) {
    if (!req.body.username || !req.body.password) {
        return res.status(400).json({
            success: false,
            msg: 'Please include both username and password to signin.'
        });
    }

    User.findOne({ username: req.body.username })
        .select('name username password')
        .exec(function (err, user) {
            if (err) {
                return handleServerError(res, err);
            }

            if (!user) {
                return res.status(401).json({
                    success: false,
                    msg: 'Authentication failed. User not found.'
                });
            }

            user.comparePassword(req.body.password, function (err, isMatch) {
                if (err) {
                    return handleServerError(res, err);
                }

                if (!isMatch) {
                    return res.status(401).json({
                        success: false,
                        msg: 'Authentication failed. Wrong password.'
                    });
                }

                var userToken = {
                    id: user._id,
                    username: user.username,
                    name: user.name
                };

                var token = jwt.sign(userToken, authJwtController.secret, {
                    expiresIn: '7d'
                });

                return res.json({
                    success: true,
                    token: token
                });
            });
        });
});

/*
    MOVIES
*/
router.route('/movies')
    .post(authJwtController.isAuthenticated, function (req, res) {
        var movie = new Movie({
            title: req.body.title,
            releaseDate: req.body.releaseDate,
            genre: req.body.genre,
            actors: req.body.actors,
            imageUrl: req.body.imageUrl
        });

        movie.save(function (err, savedMovie) {
            if (err) {
                return handleServerError(res, err);
            }

            return res.status(200).json(savedMovie);
        });
    })
    .get(authJwtController.isAuthenticated, function (req, res) {
        if (req.query.reviews === 'true') {
            return Movie.aggregate([
                {
                    $lookup: {
                        from: 'reviews',
                        localField: '_id',
                        foreignField: 'movieId',
                        as: 'reviews'
                    }
                },
                {
                    $addFields: {
                        avgRating: { $avg: '$reviews.rating' }
                    }
                },
                {
                    $sort: { avgRating: -1 }
                }
            ]).exec(function (err, movies) {
                if (err) {
                    return handleServerError(res, err);
                }

                return res.status(200).json(movies);
            });
        }

        return Movie.find({}, function (err, movies) {
            if (err) {
                return handleServerError(res, err);
            }

            return res.status(200).json(movies);
        });
    });

router.get('/movies/:id', authJwtController.isAuthenticated, function (req, res) {
    if (req.query.reviews === 'true') {
        var movieId;

        try {
            movieId = new mongoose.Types.ObjectId(req.params.id);
        } catch (e) {
            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });
        }

        return Movie.aggregate([
            {
                $match: { _id: movieId }
            },
            {
                $lookup: {
                    from: 'reviews',
                    localField: '_id',
                    foreignField: 'movieId',
                    as: 'reviews'
                }
            },
            {
                $addFields: {
                    avgRating: { $avg: '$reviews.rating' }
                }
            }
        ]).exec(function (err, movies) {
            if (err) {
                return handleServerError(res, err);
            }

            if (!movies.length) {
                return res.status(404).json({
                    success: false,
                    message: 'Movie not found'
                });
            }

            return res.status(200).json(movies[0]);
        });
    }

    return Movie.findById(req.params.id, function (err, movie) {
        if (err || !movie) {
            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });
        }

        return res.status(200).json(movie);
    });
});

router.put('/movies/:id', authJwtController.isAuthenticated, function (req, res) {
    Movie.findById(req.params.id, function (err, movie) {
        if (err) {
            return handleServerError(res, err);
        }

        if (!movie) {
            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });
        }

        movie.title = req.body.title || movie.title;
        movie.releaseDate = req.body.releaseDate || movie.releaseDate;
        movie.genre = req.body.genre || movie.genre;
        movie.actors = req.body.actors || movie.actors;
        movie.imageUrl = req.body.imageUrl || movie.imageUrl;

        movie.save(function (saveErr, updatedMovie) {
            if (saveErr) {
                return handleServerError(res, saveErr);
            }

            return res.status(200).json(updatedMovie);
        });
    });
});

router.delete('/movies/:id', authJwtController.isAuthenticated, function (req, res) {
    Movie.findByIdAndDelete(req.params.id, function (err, deletedMovie) {
        if (err) {
            return handleServerError(res, err);
        }

        if (!deletedMovie) {
            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Movie deleted'
        });
    });
});

/*
    REVIEWS
*/
router.route('/reviews')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var query = {};

        if (req.query.movieId) {
            query.movieId = req.query.movieId;
        }

        Review.find(query, function (err, reviews) {
            if (err) {
                return handleServerError(res, err);
            }

            return res.status(200).json(reviews);
        });
    })
    .post(authJwtController.isAuthenticated, function (req, res) {
        if (!req.body.movieId || !req.body.review || req.body.rating === undefined) {
            return res.status(400).json({
                success: false,
                message: 'movieId, review, and rating are required'
            });
        }

        Movie.findById(req.body.movieId, function (err, movie) {
            if (err) {
                return handleServerError(res, err);
            }

            if (!movie) {
                return res.status(404).json({
                    success: false,
                    message: 'Movie not found'
                });
            }

            var review = new Review({
                movieId: req.body.movieId,
                username: req.user.username,
                review: req.body.review,
                rating: req.body.rating
            });

            review.save(function (reviewErr) {
                if (reviewErr) {
                    return handleServerError(res, reviewErr);
                }

                trackReviewEvent(movie, req);

                return res.status(200).json({
                    message: 'Review created!'
                });
            });
        });
    });

app.use('/', router);

var port = process.env.PORT || 8080;
app.listen(port, function () {
    console.log('Server running on port ' + port);
});

module.exports = app;