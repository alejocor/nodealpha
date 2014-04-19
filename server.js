var httpd = require('http').createServer(handler);
var io = require('socket.io').listen(httpd);
var fs = require('fs');
var url = require("url");
var redisPort = 6379;
var redisHostname = 'redisdrivers.j7dno0.0001.use1.cache.amazonaws.com';
var redis = require('redis'),
RedisStore = require('socket.io/lib/stores/redis'),
pub = redis.createClient(redisPort, redisHostname),
sub = redis.createClient(redisPort, redisHostname),
client = redis.createClient(redisPort, redisHostname);
io.set('store', new RedisStore({
redisPub : pub,
redisSub : sub,
redisClient : client
}));
httpd.listen(8080);

//setInterval(checkExpires, 600000  );//ten minute check
//checkExpires(); //run it once to clear everything out if it is restarting
var Conductor = function(usuario, img, area, socketid){
	this.username = usuario;
	this.img = img;
	this.area = area;
	this.socketid = socketid;
};

function handler(req, res) {
	var pathname = url.parse(req.url).pathname;
	//console.log(pathname);
	fs.readFile(__dirname + '/'+pathname,
	function(err, data){
		if (err) {
		res.writeHead(500);
		return res.end('Error loading index.html');
		}
	res.writeHead(200);
	res.end(data);
	}
	);
}

//CANAL DE CONDUCTORES

var DriverChannel = io.of('/driver_channel').authorization(function (handshakeData, callback) {
 // console.dir(handshakeData);
  handshakeData.foo = 'autorizado';
  callback(null, true);
}).on("connection", function(socket){
	var conductor;
	//console.log(socket.handshake.foo);
	socket.emit('identificate');//lo primero que hace al crear un socket es pedir la identificacion
	socket.on('soyConductor', function(datos) {
		client.hget('vehiculos:registrados',datos.placa, function(err, data){
		if(data === null){
			socket.emit('mensajeServidor', 'Lo sentimos, usted no aparece registrado ');
			
		}else{
			activarVehiculo(datos);
			socket.join('activos:'+datos.area);//ej activos:5p:Bogota
			socket.emit('mensajeServidor', 'Se ha activado Udriver, esperando servicios...' + datos.area + ' ');
		}
	});
	socket.on('tomarServicio',function(datos){
		console.log(datos);
		socket.leave('activos:'+datos.area);
		socket.join("encarrera"+socket.id);
		client.hget('vehiculos:registrados',datos.placa, function(err, data){
		if(data === null){
			socket.emit('mensajeServidor', 'Lo sentimos, usted no aparece registrado ');
			
		}else{

		io.of('/client_channel').in(datos.room).emit('mensajeServidor', data);
		}
		});
	});
	socket.on('llegue',function(datos){
	console.log(datos);
	io.of('/client_channel').in(datos.room).emit('llegoConductor', 'Su servicio a llegado ');

	});
		
	/*
	sub.on('message', function(channel, message) {
		socket.emit(channel, message);
	});
	sub.on('subscribe', function(channel) {//en el momento de suscribir al canal entonces  publica que hay un nuevo usuario en el canal
		pub.publish('canalconductores', "mensaje de canal");
	});
	*/

		//var test = new User(username, img, area, socket.id);
		
		

	});
	socket.on('disconnect', function() {
		socket.get('conductor', function(err, username) {
		if (! username) {
		username = socket.id;
		}
		socket.broadcast.emit('mensajeServidor', 'usuario ' + username + ' se desconectó');
		});
	});
	
	

});

//CANAL DE CLIENTES
var ClientChannel = io.of("/client_channel").on("connection", function(socket){
	socket.emit('identificate');//lo primero que hace al crear un socket es pedir la identificacion
	socket.on('soyCliente', function(content) {

	//	socket.broadcast.emit('resolverServicio', username + ' dijo: ' + content);

	});
	socket.on('demeServicio', function(datos) {
		console.log(datos);
		socket.join("carrera"+socket.id);
		io.of('/driver_channel').in("activos:5p:Bogota").emit('nuevoServicio', {latitud: datos.latitud, longitud: datos.longitud,room:"carrera"+socket.id});
	});
	
});


function activarVehiculo(datos){
	client.sadd('activos:'+datos.area, 'vehiculos:registrados:'+ datos.placa);
}

function setUser(username, img, area, expire){
	client.set(area+':conductores:' + username, username);
	client.expire(area+':conductores:' + username, expire);
	client.set(area+':conductores:' + username + ':img', img);
	client.expire(area+':conductores:' + username + ':img', expire);
	//set a timer
	client.set(area+':conductores:timer', expire);
	client.expire(area+':conductores:timer', expire);
	client.sadd(area+':conductores', area+':conductores:' + username);
	//add the set to the expire set
	client.sadd('expireKeys', area+':conductores');
}

function checkExpires(){
	//grab the expire set
	client.smembers('expireKeys', function(err, keys){
		if(keys != null){
			keys.forEach(function(key){
				client.get(key+':timer', function(err, timer){
					//grab the timer
					if(timer != null){
						//timer exists check the ttl on it
						client.ttl(key+':timer', function(err, ttl){
							//the ttl is two hours and if it is under
							//a half hour we delete it
							if(ttl < 18000){
								client.del(key);
								client.srem('expireKeys', key);
							}
						});
					}else{
						//the timer is gone delete the key
						client.del(key);
						client.srem('expireKeys', key);
					}
				})
			});
		}
	});
};




























