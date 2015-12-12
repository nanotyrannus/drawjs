console.log("index javascript file loaded")

var clientId = "238992325838-2diiucvne65tvsk856kctfagfp5ndq9q.apps.googleusercontent.com"

var googleOAuth = document.getElementById("google-oauth")
googleOAuth.addEventListener("click", function () {
  var url = "https://accounts.google.com/o/oauth2/auth?"
  var xhr = new XMLHttpRequest();
  window.location.href = url + "client_id=" + clientId + "&scope=email%20profile&response_type=token&redirect_uri=http://ec2-52-8-54-187.us-west-1.compute.amazonaws.com/login"
})
