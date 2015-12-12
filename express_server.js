"use strict"
var express = require("express")
var cookieParser = require("cookie-parser")
var app = express()
var WebSocketServer = require("ws").Server
var wss = new WebSocketServer({"port" : 8080})
var Entities = require("./Entities.js")
var events = require("events")
var bodyParser = require("body-parser")
var session = require("express-session")
var http = require("request")
var querystring = require("querystring")

var generateID = function (length) {
	function randomInteger (min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
	var id;
	do {
		id = "";
		for (var i = 0; i < length; ++i) {
			id += String.fromCharCode(randomInteger(65, 90))
		}
	} while (ids.has(id));
	ids.set(id, true)
	return id;
}

//users are instances of connections to rooms
//accounts are a mapping of actual users to session IDs
var instances = new Map(), users = new Array(), ids = new Map(), accounts = new Array()

app.set("view engine", "jade")

app.use(session({
	"secret" : "this is the secret key"
}))
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

app.get("/test", function (req, res) {
	res.send("Test page.")
})

app.get("/", function (req, res) {
	if (req.cookies.foo) {
		var instance = new Entities.Instance(generateID(5))
		instances.set(instance.id, instance)
		res.cookie("instance_id", instance.id)
	} else {
		res.cookie("foo", "bar", {"maxAge" : 1000*60*30})
		if (req.session.visits) {
			req.session.visits++
			console.log(req.session)
		} else {
			req.session.visits = 1
		}
	}
	res.sendFile("/home/ubuntu/sketchy/public/index/index.html");
})

// app.post("/", function (req, res) { //for recieving information to be logged
//     console.log("POST TO LOG\n", req.body)
// })

app.get("/login", function (req, res, next) {
	if (Object.keys(req.query).length != 0) {
		console.log("---session id---", req.sessionID)
		for (var prop in req.query) {
			req.session[prop] = req.query[prop]
		}
		console.log("wrote to session", req.session)

		http.get("https://www.googleapis.com/plus/v1/people/me?" + "access_token=" + req.query.access_token, function (err, response, body) {
			var parsedBody = JSON.parse(body);
			console.log("PARSED BODY", parsedBody)
			req.session.avatar = parsedBody.image.url
			req.session.name = parsedBody.displayName
			req.session.loggedIn = true
			res.send("success")
		})
	} else {
		res.sendFile("/home/ubuntu/sketchy/public/login/login.html")
	}
})

// app.post("/login", function (req, res) {
// 	console.log("post recieved")
// 	console.log("access token from post " + req.body.access_token)
// 	res.cookie("access_token", req.body.access_token)
// 	req.session.access_token = req.body.access_token
// 	res.end()
// })

app.post("/", function (req, res) {
	console.log(req.body)
	var instance = new Entities.Instance(generateID(5))
	instances.set(instance.id, instance)
	res.cookie("instance_id", instance.id)
	res.send("instance/" + instance.id)
})

app.use(express.static("public"))

app.get(/instance\/.{5}/, function (req, res) {
	console.log("new user entering instance", req.url, req.sessionID)
	if (instances.has(req.url.split("/instance/")[1])){
		res.sendFile("/home/ubuntu/sketchy/public/main_pure.html", {"root" : process.env.PWD})
	} else {
		res.end("Room not found")
	}
})

app.get("/home", function (req, res) {
	res.render("home", {
		"title": "your hope page",
		"avatar" : req.session.avatar,
		"displayName" : req.session.name
	})
})

var server = app.listen(80, function () {})

var Type = {
	"STROKE" : 0,
	"ERASE": 1,
	"UNDO" : 2,
	"REDO" : 3,
	"CLEAR" : 4,
	"JOIN" : 5,
	"ASSIGNMENT" : 6,
	"SUBSTROKE" : 7,
	"DATA" : 8
}

class Timer extends events.EventEmitter {
	constructor() {
		super()
	}
	init() {
		setInterval(function () {
			this.emit("tick")
		}.bind(this), 1000)
	}
}
var strokes = 0, substrokes = 0, passphrase = ""+(Date.now())
console.log(passphrase)

wss.on("connection", function (ws) {
	var connectingUser = new Entities.User(generateID(6), ws)
	users.push(connectingUser)
	connectingUser.send(JSON.stringify({
		"type" : Type.ASSIGNMENT,
		"body" : connectingUser.id
	}))
	ws.on("message", function (msg) {
		var parsed = JSON.parse(msg)
		if (parsed.type === Type.JOIN) {
			if(!instances.has(parsed.body)) {
				ws.send("Room not found")
				return
			}
			console.log("Adding user " + connectingUser.id + " to room " + parsed.body)
			instances.get(parsed.body).addUser(connectingUser)
		} else if (parsed.type === Type.STROKE || parsed.type === Type.SUBSTROKE) {
			if (parsed.type === Type.STROKE) {
				strokes += msg.length
			} else if (parsed.type === Type.SUBSTROKE) {
				substrokes += msg.length
			}
			console.log("user: ", connectingUser.id, " type: ", parsed.type, " ")
			instances.get(connectingUser.roomID).updateUsers(msg)
		} else if (parsed.type == Type.DATA && parsed.body == passphrase) {
			console.log("admin access granted")
			var timer = new Timer()
			timer.init()
			timer.on("tick", function () {
				ws.send(JSON.stringify({
					"type" : Type.DATA,
					"strokes" : strokes,
					"substrokes" : substrokes
				}))
				strokes = 0
				substrokes = 0
			})
		} else {
			instances.get(connectingUser.roomID).updateUsers(msg)
		}
	})
})
