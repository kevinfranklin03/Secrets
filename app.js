require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-Local-Mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');


const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({extended: true}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function (err, user) {
      done(err, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_APP_ID,
    clientSecret: process.env.GOOGLE_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"

  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", (req,res)=>{
    res.render("home")
});


app.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
    passport.authenticate('google', { failureRedirect: '/login' }),
        function(req, res) {
        // Successful authentication, redirect home.
        res.redirect('/secrets');
    });

app.get("/login", (req,res)=>{
    res.render("login")
});

app.get("/register", (req, res)=> {
    res.render("register");
});

app.get("/secrets", (req, res)=> {
   User.find({"secret": {$ne: null}}, (err, foundUser)=>{
    if (err) {
        console.log(err);
    } else {
        if(foundUser) {
            res.render("secrets", {userWithSecrets: foundUser});
        }
    }
   });
});

app.get("/logout", (req, res)=>{
    // req.logout();
    res.redirect("/");
});

app.get("/submit",(req, res)=> {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit",(req, res)=>{
    const submittedSecret = req.body.secret;
    const userId = req.user.id;

    User.findById(userId, (err, foundUser)=>{
        if (err) {
            console.log(err);
        } else {
            if(foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(()=>{
                    res.redirect("/secrets");
                });
            }
        }
    });
});


app.post("/register", (req,res)=>{
    User.register({username: req.body.username}, req.body.password, (err, user)=>{
        if(err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local") (req, res, ()=>{
                res.redirect("/secrets");
            });
        }
    });
    
});


app.post("/login", (req, res)=>{
const user = new User({
    username: req.body.username,
    password: req.body.password
});

req.login(user, (err)=>{
    if(err) {
        console.log(err);
    } else {
        passport.authenticate("local")(req, res, ()=>{
            res.redirect("/secrets")
        });
    }
});

});

// app.post("/login", function (req, res) {
 
//     const username = req.body.username;
//     const password = req.body.password;
 
//     User.findOne({email:username , password: password}, function (err,results) {
//         if(results){
//             res.render("secrets")
//         }else{
//             res.send("There is something wrong with your username or password")
//         }
//     })
// })

app.listen(3000, ()=>{
    console.log("server started on port 3000");
})
