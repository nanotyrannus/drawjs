"use strict"
var express = require("express")
var cookieParser = require("cookie-parser")
var app = express()
var WebSocketServer = require("ws").Server
var wss = new WebSocketServer({"port" : 8080})
var Entities = require("./Entities.js")
var events = require("events")

var generateID = function(length) {
	function randomInteger(min, max){
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

var instances = new Map(), users = new Array(), ids = new Map()

app.use(cookieParser())

app.use(express.static("public"))

app.get("/test", function (req, res) {
	res.send("redirected")
})

app.get(/instance\/.{5}/, function (req, res) {
	res.sendFile("/home/ubuntu/sketchy/public/main_pure.html", {"root" : process.env.PWD})
})

app.get("/", function (req, res) {
	if (req.cookies.foo) {
		var instance = new Entities.Instance(generateID(5))
		instances.set(instance.id, instance)
		res.cookie("instance_id", instance.id)
		res.redirect("instance/" + instance.id)
	} else {
		console.log("cookies ", req.cookies)
		res.cookie("foo", "bar", {"maxAge" : 1000*60*30})
		res.cookie("baz", "blix")
		res.send("test")
	}
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
