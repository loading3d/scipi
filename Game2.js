class Game{
	constructor() {
		if ( ! Detector.webgl ) Detector.addGetWebGLMessage();		
		this.container;
		this.player = {};
        	this.animations = {};

		this.camera;
		this.scene;
		this.renderer;
		
		this.container = document.createElement( 'div' );
		this.container.style.height = '100%';
		document.body.appendChild( this.container );
        
		const game = this;
		//this.anims = ['Walking', 'Walking Backwards', 'Turn', 'Running', 'Pointing Gesture'];     
		this.anims = ["DefaultFemaleWalkInPlace"];        		
		this.clock = new THREE.Clock();        
        	//this.init(CharacterIdleFilePath, CharacterWalkingFilePath, TreasureImageFilePath, TreasureType);

		window.onError = function(error){
			console.error(JSON.stringify(error));
		}
	}
	
	init(CharacterIdleFilePath, CharacterWalkingFilePath, TreasureImageFilePath, TreasureType) {
		this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 50000);
		this.camera.position.set(112, 100, 600);
        
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 0xa0a0a0 );
		//this.scene.fog = new THREE.Fog( 0xa0a0a0, 700, 4000 );

		let light = new THREE.HemisphereLight( 0xffffff, 0x444444 );
		light.position.set( 0, 200, 0 );
		this.scene.add( light );

        	const shadowSize = 200;
		light = new THREE.DirectionalLight( 0xffffff );
		light.position.set( 0, 200, 100 );
		light.castShadow = true;
		light.shadow.camera.top = shadowSize;
		light.shadow.camera.bottom = -shadowSize;
		light.shadow.camera.left = -shadowSize;
		light.shadow.camera.right = shadowSize;
        	this.sun = light;
		this.scene.add( light );

		const loader = new THREE.FBXLoader();
		const game = this;


//////////////////////////// START CUSTOMIZE ////////////////////////////////

		this.colliders = [];

		const map = new THREE.TextureLoader().load(TreasureImageFilePath);
		map.wrapS = map.wrapT = THREE.RepeatWrapping;
		map.anisotropy = 16;

		const TreasureMaterial = new THREE.MeshPhongMaterial( { map: map, side: THREE.DoubleSide } );
		var RandomX = Math.random() * 11000 - 1000;
		var RandomZ = Math.random() * 10000 - 9000;
		console.log("Treasure at " + RandomX + " " + RandomZ);


		if(TreasureType == "SphereTreasure") {
			var object = new THREE.Mesh( new THREE.SphereGeometry(75, 20, 10), TreasureMaterial);
			object.position.set(RandomX, 50, RandomZ);
            		game.scene.add(object);
        		this.colliders.push(object);
		}

		if(TreasureType == "BoxTreasure") {
			object = new THREE.Mesh( new THREE.BoxGeometry(100, 100, 100, 4, 4, 4), TreasureMaterial);
			object.position.set(RandomX, 50, RandomZ);
            		game.scene.add(object);
        		this.colliders.push(object);
		}

		if(TreasureType == "RingTreasure") {
			object = new THREE.Mesh( new THREE.TorusGeometry(50, 20, 20, 20), TreasureMaterial);
			object.position.set(RandomX, 50, RandomZ);
            		game.scene.add(object);
        		this.colliders.push(object);
		}

		loader.load("https://cdn.jsdelivr.net/gh/loading3d/multi-player/blockland/assets/fbx/town.fbx", function(object){
			object.position.set(0, 0, 1500);
			game.environment = object;
			game.colliders = [];
			game.scene.add(object);
            
			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					if (child.name.startsWith("proxy")) {
						game.colliders.push(child);
						child.material.visible = false;
					}else {
						child.castShadow = true;
						child.receiveShadow = true;
					}
				}
			} );
			
			const tloader = new THREE.CubeTextureLoader();
			tloader.setPath("https://cdn.jsdelivr.net/gh/loading3d/multi-player/blockland/assets/images/");

			var textureCube = tloader.load( [
				'px.jpg', 'nx.jpg',
				'py.jpg', 'ny.jpg',
				'pz.jpg', 'nz.jpg'
			] );

			game.scene.background = textureCube;
		})

		loader.load(CharacterIdleFilePath, function (object) {
			object.mixer = new THREE.AnimationMixer(object);
			game.player.mixer = object.mixer;
			game.player.root = object.mixer.getRoot();
			
			object.name = "Player";
					
			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					child.castShadow = true;
					child.receiveShadow = false;		
				}
			} );
			            
            		game.player.object = new THREE.Object3D();
			game.scene.add(game.player.object);
			game.player.object.add(object);
			game.animations.Idle = object.animations[0];
            
            		game.loadNextAnim(loader, CharacterWalkingFilePath);
		} );

		this.renderer = new THREE.WebGLRenderer({antialias:true});
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.shadowMap.enabled = true;
		this.container.appendChild(this.renderer.domElement);
        
		window.addEventListener('resize', function(){ game.onWindowResize(); }, false);
	}
	
    	loadNextAnim(loader, CharacterWalkingFilePath) {
		let anim = this.anims.pop();
		const game = this;
		loader.load(CharacterWalkingFilePath, function(object) {
			game.animations[anim] = object.animations[0];
			if (game.anims.length > 0) {
				game.loadNextAnim(loader);
			}else {
                		game.createCameras();
                		game.joystick = new JoyStick({
                    			onMove: game.playerControl,
                    			game: game
                		});
				delete game.anims;
				game.action = "Idle";
				game.animate();
			}
		});	
	}

	movePlayer(dt) {
		const pos = this.player.object.position.clone();
		pos.y += 60;
		let dir = new THREE.Vector3();
		this.player.object.getWorldDirection(dir);
		if (this.player.move.forward<0) dir.negate();
		let raycaster = new THREE.Raycaster(pos, dir);
		let blocked = false;
		const colliders = this.colliders;
	
		if (colliders!==undefined) { 
			const intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) blocked = true;
			}
		}
		
		if (!blocked) {
			if (this.player.move.forward>0){
				const speed = (this.player.action=='Running') ? 400 : 150;
				this.player.object.translateZ(dt*speed);
			}else {
				this.player.object.translateZ(-dt*30);
			}
		}
		
		if (colliders!==undefined) {
			//cast left
			dir.set(-1,0,0);
			dir.applyMatrix4(this.player.object.matrix);
			dir.normalize();
			raycaster = new THREE.Raycaster(pos, dir);

			let intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) this.player.object.translateX(100-intersect[0].distance);
			}
			
			//cast right
			dir.set(1,0,0);
			dir.applyMatrix4(this.player.object.matrix);
			dir.normalize();
			raycaster = new THREE.Raycaster(pos, dir);

			intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) this.player.object.translateX(intersect[0].distance-100);
			}
			
			//cast down
			dir.set(0,-1,0);
			pos.y += 200;
			raycaster = new THREE.Raycaster(pos, dir);
			const gravity = 30;

			intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				const targetY = pos.y - intersect[0].distance;
				if (targetY > this.player.object.position.y){
					//Going up
					this.player.object.position.y = 0.8 * this.player.object.position.y + 0.2 * targetY;
					this.player.velocityY = 0;
				}else if (targetY < this.player.object.position.y){
					//Falling
					if (this.player.velocityY==undefined) this.player.velocityY = 0;
					this.player.velocityY += dt * gravity;
					this.player.object.position.y -= this.player.velocityY;
					if (this.player.object.position.y < targetY){
						this.player.velocityY = 0;
						this.player.object.position.y = targetY;
					}
				}
			}else if (this.player.object.position.y>0) {
                		if (this.player.velocityY==undefined) this.player.velocityY = 0;
                		this.player.velocityY += dt * gravity;
                		this.player.object.position.y -= this.player.velocityY;
                		if (this.player.object.position.y < 0){
                    			this.player.velocityY = 0;
                    			this.player.object.position.y = 0;
                		}
            		}
		}
        
        	this.player.object.rotateY(this.player.move.turn*dt);
	}
    
    
	onWindowResize() {
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( window.innerWidth, window.innerHeight );
	}

    	set action(name){
		const action = this.player.mixer.clipAction( this.animations[name] );
        	action.time = 0;
		this.player.mixer.stopAllAction();
		this.player.action = name;
		this.player.actionTime = Date.now();		
		action.fadeIn(0.5);	
		action.play();
	}
    
    	get action(){
        	if (this.player===undefined || this.player.actionName===undefined) return "";
        	return this.player.action;
    	}
    
    	playerControl(forward, turn){
		turn = -turn;
		
		if (forward>0.3){
			//if (this.player.action!='Walking' && this.player.action!='Running') this.action = 'Walking';
			if (this.player.action!='Walking' && this.player.action!='Running') this.action = 'DefaultFemaleWalkInPlace';
		}else if (forward<-0.3){
			//if (this.player.action!='Walking Backwards') this.action = 'Walking Backwards';
			if (this.player.action!='Walking Backwards') this.action = 'DefaultFemaleWalkInPlace';
		}else{
			forward = 0;
			if (Math.abs(turn)>0.1){
				//if (this.player.action != 'Turn') this.action = 'Turn';
				if (this.player.action != 'Turn') this.action = 'DefaultFemaleWalkInPlace';
			}else if (this.player.action!="Idle"){
				this.action = 'Idle';
			}
		}
		
		if (forward==0 && turn==0){
			delete this.player.move;
		}else{
			this.player.move = { forward, turn }; 
		}
	}
    
    	set activeCamera(object){
		this.player.cameras.active = object;
	}
    
    	createCameras() {
		const offset = new THREE.Vector3(0, 80, 0);
		const front = new THREE.Object3D();
		front.position.set(112, 100, 600);
		front.parent = this.player.object;
		const back = new THREE.Object3D();
		back.position.set(0, 300, -600);
		back.parent = this.player.object;
		const wide = new THREE.Object3D();
		wide.position.set(178, 139, 1665);
		wide.parent = this.player.object;
		const overhead = new THREE.Object3D();
		overhead.position.set(0, 400, 0);
		overhead.parent = this.player.object;
		const collect = new THREE.Object3D();
		collect.position.set(40, 82, 94);
		collect.parent = this.player.object;
		this.player.cameras = { front, back, wide, overhead, collect };
		//game.activeCamera = this.player.cameras.back;	
		this.activeCamera = this.player.cameras.back;	
	}
    
	animate() {
		if (Math.round(this.clock.elapsedTime) % 20 == 1) console.log(this.player.object.position);	
		//console.log(this.clock.elapsedTime);	

		const game = this;
		const dt = this.clock.getDelta();	
		requestAnimationFrame( function(){ game.animate(); } );	
	
		if (this.player.mixer!==undefined) this.player.mixer.update(dt);
		
        	if (this.player.action=='Walking'){
			const elapsedTime = Date.now() - this.player.actionTime;
			if (elapsedTime>1000 && this.player.move.forward>0){
				//this.action = 'Running';
				this.action = 'DefaultFemaleWalkInPlace';
			}
		}
		
		if (this.player.move !== undefined) this.movePlayer(dt);
		
		if (this.player.cameras!=undefined && this.player.cameras.active!=undefined){
			this.camera.position.lerp(this.player.cameras.active.getWorldPosition(new THREE.Vector3()), 0.05);
			const pos = this.player.object.position.clone();
			pos.y += 200;
			this.camera.lookAt(pos);
		}
        
        	if (this.sun != undefined){
            		this.sun.position.x = this.player.object.position.x;
            		this.sun.position.y = this.player.object.position.y + 200;
            		this.sun.position.z = this.player.object.position.z + 100;
            		this.sun.target = this.player.object;
        	}
   
		this.renderer.render(this.scene, this.camera);
	}
}
