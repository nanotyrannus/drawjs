//////////////////
//Initialization//
//////////////////

var $ = document;

$.getElementById("pencil-button").addEventListener("click", function(){cursor.mode = Mode.PENCIL})
$.getElementById("brush-button").addEventListener("click", function(){cursor.mode = Mode.BRUSH})
$.getElementById("erase-button").addEventListener("click", function(){cursor.mode = Mode.ERASE})

var roomInfo = $.getElementById("room-info")
var canvasElm = $.getElementById("view")
var context = canvasElm.getContext("2d")
context.lineJoin = "round";

var ws = new WebSocket("ws://52.8.54.187:8080");
//var ws = new WebSocket("ws://localhost:8080")
var sessionID = "";
ws.addEventListener("message", function(message){
  var chunk = JSON.parse(message.data);
  console.log(chunk.body)
  if (chunk.type === Type.STROKE) {
    if (!cursor.isActive) {
      strokes.insert(new Stroke(chunk.body))
      redraw();
    } else {
      strokeQueue.push(chunk.body);
    }
  } else if (chunk.type === Type.ASSIGNMENT){
    sessionID = chunk.body;
  } else if (chunk.type === Type.UNDO) {
    console.log("undo received!")
    strokes.getStrokeByTimestamp(chunk.body).visible = false
    redraw()
  } else if (chunk.type === Type.REDO) {
    console.log("redo received!")
    strokes.getStrokeByTimestamp(chunk.body).visible = true
    redraw()
  }
});

roomID = location.href.split("/instance/")[1]

ws.addEventListener("open", function() {
  if(roomID) {
    send(Type.JOIN, roomID)
  }
})


var send = function(type, body){
  var message = {
    "user" : sessionID,
    "type" : type,
    "body" : body
  };
  ws.send(JSON.stringify(message));
  console.log("sent ", message)
};


var Mode = {
  "PENCIL" : 0,
  "BRUSH" : 1,
  "RECTANGLE" : 2,
  "OVAL" : 3,
  "SELECT" : 4,
  "STAMP" : 5,
  "ERASE" : 6
};

var Type = {
  "STROKE" : 0,
  "ERASE": 1,
  "UNDO" : 2,
  "REDO" : 3,
  "CLEAR" : 4,
  "JOIN" : 5,
  "ASSIGNMENT" : 6,
"SUBSTROKE_START" : 7,
"SUBSTROKE_CONT" : 8,
"SUBSTROKE_END" : 9
}

var cursor = {
  "mode" : Mode.PENCIL,
  "isActive" : false,
  "color" : "000000",
  "radius" : 1,
  "brushIndex" : 0
};


var invertColor = function(color){
  //TODO
  return null;
};

var reorder = function(){
  strokes.sort(function(a,b){
    return a.timestamp - b.timestamp;
  });
};

var brushes = new Array();
brushes.addBrush = function(name, url){
  var img = new Image();
  img.src = url;
  brushes.push(img);
  img.addEventListener("load",
  function(){
    img.halfWidth = Math.floor(img.naturalWidth / 2);
    img.halfHeight = Math.floor(img.naturalHeight / 2);
  });
}

brushes.addBrush("basic", "assets/brush.png");
brushes.addBrush("kappa", "assets/kappa.png");

//One stroke represents a single undo-able move
var strokes = new Array();

strokes.insert = function(stroke) {
  if(!strokes[0]) {
    strokes[0] = stroke
  } else {
    var s, i = strokes.length;
    while (s = strokes[--i]) {
      if (s.timestamp < stroke.timestamp) {
        strokes.splice(i + 1, 0, stroke)
        console.log("inserted at index ", " ", i)
        return;
      }
    }
  }
};

strokes.assert = function(){
  for (var i = 1; i < strokes.length; ++i) {
    if (strokes[i-1].timestamp > strokes[i].timestamp) {
      return false
    }
  }
  return true
}

strokes.getStrokeByTimestamp = function(ts) {
  for (var i = strokes.length - 1; i >= 0; --i) {
    if (strokes[i].timestamp === ts) {
      return strokes[i]
    }
  }
}

var unstrokes = new Array();
var strokeQueue = new Array();
var cache = new Array();
var cacheIndices = new Array();

var Stroke = function(stroke) {
  if(!stroke) {
    stroke = 0;
  } else {
    console.log("copying stroke from " + stroke.owner)
  }
  this.visible = true;
  this.mode = cursor.mode;
  if (this.mode === Mode.STAMP) {
    this.brushIndex = cursor.brushIndex;
  }
  this.owner = stroke.owner || sessionID;
  this.x = stroke.x || new Array();
  this.y = stroke.y || new Array();
  this.radius = stroke.radius || new Array();
  this.color = stroke.color || new Array();
  this.timestamp = stroke.timestamp || (new Date()).valueOf();
}

Stroke.prototype = {
  "update" : function(nextX, nextY){
    this.x.push(nextX);
    this.y.push(nextY);
    this.radius.push((cursor.mode === Mode.PENCIL) ? 1 : getRadius());
    this.color.push((cursor.mode === Mode.ERASE) ? "FFFFFF" : getColor());
  }
};

var getBrushIndex = function(i){
  return cursor.brushIndex;
};

var getRadius = function(){
  return cursor.radius;
};

var getColor = function(){
  return cursor.color;
}

/*
Rendering of images with static color
and radius can be optimized
by calling beginPath() and stroke()
before and after the loop, respectively
*/
var render = function(stroke) {
  if (!stroke.visible) {
    return;
  }
  var x = stroke.x;
  var y = stroke.y;
  var color = stroke.color;
  var radius = stroke.radius;

  if (stroke.mode === Mode.STAMP) {
    var scale = 1 + ((radius[x.length - 1] - 1) / 100);
    var width = Math.floor(brushes[stroke.brushIndex].naturalWidth * scale);
    var height = Math.floor(brushes[stroke.brushIndex].naturalHeight * scale);
    var halfWidth = Math.floor(width/2);
    var halfHeight = Math.floor(height/ 2);
    context.drawImage(brushes[stroke.brushIndex], x[x.length - 1] - halfWidth, y[x.length - 1] - halfHeight, width, height);
  } else if (stroke.mode === Mode.PENCIL || stroke.mode === Mode.BRUSH) {
    x.forEach(function (elm, i) {
      context.beginPath();
      context.strokeStyle = "#" + color[i];
      context.lineWidth = radius[i];
      if (i) {
        context.moveTo(x[i-1], y[i-1]);
      } else {
        context.moveTo(x[i] - 1, y[i]);
      }
      context.lineTo(x[i], y[i]);
      context.closePath();
      context.stroke();
    })
  }
}

var randomColor = function(){
  var num = Math.floor(Math.random()*0xFFFFFF).toString(16);
  while (num.length < 6) {
    num = "0" + num;
  }
  return num;
}

var undo = function(){
  function topOwnStroke() {
    for (var i = strokes.length - 1; i >= 0; i--) {
      if (strokes[i].owner === sessionID) {
        return strokes.splice(i, 1)[0]
      }
    }
    return null
  }
  var unstroke;
  if (unstroke = topOwnStroke()) {
    unstrokes.push(unstroke)
    console.log(unstroke.timestamp);
    send(Type.UNDO, unstroke.timestamp);
    redraw()
    return true
  } else {
    return false
  }
}

var redo = function(){
  if(unstrokes.length > 0) {
    var stroke = unstrokes.pop()
    strokes.push(stroke);
    send(Type.REDO, stroke.timestamp);
    redraw();
    return true
  } else {
    return false
  }
};

//need to optimize with cache of canvas states
function redraw() {
  context.clearRect(0, 0, canvasElm.width, canvasElm.height);
  if (strokes[0]) {
    strokes.forEach(function (stroke) {
      render(stroke)
    })
  } else {
    context.clearRect(0, 0, canvasElm.width, canvasElm.height);
  }
}

var clear = function(){
  for(var i = 0; i < strokes.length; ++i) {
    if (strokes[i].owner === sessionID) {
      strokes.splice(i--, 1)
    }
  }
  redraw()
};

////////////////
//Input events//
////////////////

canvasElm.addEventListener("mousedown",
function(e){
  if (e.which !== 1) return; //filter out right-clicks
  if (unstrokes[0]) {
    unstrokes = new Array();
  }
  var x = e.pageX - canvasElm.offsetLeft;
  var y = e.pageY - canvasElm.offsetTop;
  cursor.isActive = true;
  strokes.push(new Stroke());
  strokes[strokes.length - 1].update(x, y); //add substroke message
  if (cursor.mode === Mode.STAMP) {
    strokes[strokes.length - 1].brushIndex = getBrushIndex();
    strokes[strokes.length - 1].brush = true;
  }
  render(strokes[strokes.length - 1]);
});

canvasElm.addEventListener("mousemove",
function(e){
  if (cursor.isActive) {
    var x = e.pageX - canvasElm.offsetLeft;
    var y = e.pageY - canvasElm.offsetTop;
    strokes[strokes.length - 1].update(x, y);
    if (cursor.mode === Mode.STAMP) {
      strokes[strokes.length - 1].brushIndex = getBrushIndex();
    }
    render(strokes[strokes.length - 1]);
  }
});

$.addEventListener("mouseup", function(e){
  if(cursor.isActive) {
    send(Type.STROKE, strokes[strokes.length - 1])
    cursor.isActive = false;
  }
  if (strokeQueue[0]) {
    strokeQueue.forEach(function(stroke){
      //strokes.push(stroke);
      strokes.insert(stroke)
    });
    strokeQueue = new Array();
    //reorder(); //bad
    redraw();
  }
});

$.addEventListener("keydown",
function(e){
  var event = window.event ? window.event : e;
  if (event.keyCode == 90 && event.ctrlKey) {
    if (undo()) {
      generateNotice("undo")
    } else {
      generateNotice("no moves to undo")
    }
  } else if (event.keyCode == 89 && event.ctrlKey) {
    if (redo()) {
      generateNotice("redo")
    } else {
      generateNotice("no moves to redo")
    }
  } else if (event.keyCode == 80) { // p
    cursor.mode = Mode.PENCIL
    generateNotice("pencil")
  } else if (event.keyCode == 66) { // b
    cursor.mode = Mode.BRUSH
    generateNotice("brush")
  } else if (event.keyCode == 69) { // e
    cursor.mode = Mode.ERASE
    generateNotice("eraser")
  } else if (event.which === 219 && cursor.radius != 1) {
    if (event.shiftKey) {
      decrementRadius(5)
    } else {
      decrementRadius(1)
    }
  } else if (event.which === 221 && cursor.radius != 100) {
    if (event.shiftKey) {
      incrementRadius(5)
    } else {
      incrementRadius(1)
    }
  } else if (event.which > 48 && event.which < 58) { //1-9
    cursor.brushIndex = event.which - 49;
  }
});

var incrementRadius = function(amt){
  if (cursor.radius + amt > 100) {
    cursor.radius = 100
  } else {
    cursor.radius += amt
  }
  generateNotice("brush size: " + cursor.radius)
}

var decrementRadius = function(amt){
  if (cursor.radius - amt < 1) {
    cursor.radius = 1
  } else {
    cursor.radius -= amt
  }
  generateNotice("brush size: " + cursor.radius)
}

var notice = $.getElementById("notice")

var generateNotice = function(message) {
  notice.textContent = message
  notice.className = "notice-active"
  if (generateNotice.PID) {
    clearTimeout(generateNotice.PID)
    generateNotice.PID = null
  }
  generateNotice.PID = setTimeout(function(){
    notice.className = "notice-inactive"
  }, 1000)
}
