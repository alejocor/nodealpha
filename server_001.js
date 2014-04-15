var httpd = require('http').createServer(handler);
var io = require('socket.io').listen(httpd);
var fs = require('fs');
var redisPort = 6379;
var redisHostname = '127.0.0.1';
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
httpd.listen(4000);
var conductores={};
function handler(req, res) {
	fs.readFile(__dirname + '/conductor.html',
	function(err, data) {
		if (err) {
		res.writeHead(500);
		return res.end('Error loading index.html');
		}
	res.writeHead(200);
	res.end(data);
	}
	);
}
var chat = io.of('/bogota');
io.sockets.on('connection', function (socket) {
	socket.emit('identificate');//lo primero que hace al crear un socket es pedir la identificacion
	//ingreso de cliente 
	socket.on('soyCliente', function(content) {

		socket.broadcast.emit('resolverServicio', username + ' dijo: ' + content);

	});
	//ingreso de cliente 
	socket.on('soyConductor', function(content) {
		client.set('usuario:' + content.usuario, socket.id);
		socket.get('room', function(err, oldRoom) { // leemos la variable room para saber si el usuario estaba en otra sala
					if (err) { throw err; }
				socket.set('room', 'conductores', function(err) { //agregamos al conductor en la sala de conductores
						if (err) { throw err; }
						socket.join('conductores'); //lo asociamos a la sala creada
						if (oldRoom) {
						socket.leave(oldRoom); //si el usuario estaba en otra sala entonces lo sacamos de ella
						}
					 client.get('usuario:' + content.usuario, function (err, socketId) {
						io.sockets.socket(socketId).emit('mensajeServidor', 'Senor conductor, ahora esta activo con redis ');
						});

				//	socket.emit('mensajeServidor', 'Senor conductor, ahora esta activo '); 
					socket.broadcast.to('conductores').emit('mensajeServidor', 'Se unio otro conductor');
					});
				});

	});
	//El cliente pide servicio
	socket.on('encontrarServicio', function(content) {

		socket.broadcast.emit('resolverServicio', username + ' dijo: ' + content);

	});


	socket.on('mensajeCliente', function(content) {
		socket.emit('mensajeServidor', 'Usted dijo: ' + content);
		socket.get('usuario', function(err, username) {
		if (!username) {
			username = socket.id;
		}
		socket.broadcast.emit('mensajeServidor', username + ' dijo: ' + content);
		});
	});
	
	socket.on('disconnect', function() {
		socket.get('usuario', function(err, username) {
		if (! username) {
		username = socket.id;
		}
		socket.broadcast.emit('mensajeServidor', 'usuario ' + username + ' se desconectó');
		});
	});
	socket.on('login',function(usuario){
		socket.set('usuario', usuario);
		socket.emit('mensajeServidor',' Se ha logueado como:'+usuario);

	});
	socket.on('join', function(room) {
				socket.get('room', function(err, oldRoom) { // leemos la variable room para saber si el usuario estaba en otra sala
					if (err) { throw err; }
				socket.set('room', room, function(err) { //agregamos a room la sala enviada por el usuario
						if (err) { throw err; }
						socket.join(room); //lo asociamos a la sala creada
						if (oldRoom) {
						socket.leave(oldRoom); //si el usuario estaba en otra sala entonces lo sacamos de ella
						}
					socket.emit('mensajeServidor', 'Se unio a la sala de chat '+ room); 
					socket.get('usuario', function(err, username){
						if (!username){
						username = socket.id;
						}
						socket.broadcast.to(room).emit('mensajeServidor', 'Usuario ' +username + ' se ha unido a esta sala');
					});
				});
				});
			});
	
});
