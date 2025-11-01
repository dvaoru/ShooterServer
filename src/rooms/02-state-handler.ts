import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
    @type("int8")
    loss = 0;

    @type("number")
    speed = 0;

    @type("int8")
    maxHP = 0;

    @type("int8")
    currentHP = 0;

    @type("number")
    pX = Math.floor(Math.random() * 50) - 25;

    @type("number")
    pY = 0;

    @type("number")
    pZ = Math.floor(Math.random() * 50) - 25;

    @type("number")
    vX = 0;

    @type("number")
    vY = 0;

    @type("number")
    vZ = 0;

    @type("number")
    rX = 0;

    @type("number")
    rY = 0;
}

export class State extends Schema {
    @type({ map: Player })
    players = new MapSchema<Player>();

    something = "This attribute won't be sent to the client-side";

    createPlayer(sessionId: string, data: any, position: Point) {
        const player = new Player();
        player.pX = position.x;
        player.pY = position.y;
        player.pZ = position.z;
        player.speed = data.speed;
        player.maxHP = data.hp;
        player.currentHP = data.hp;
        this.players.set(sessionId, player);
    }

    removePlayer(sessionId: string) {
        this.players.delete(sessionId);
    }

    movePlayer(sessionId: string, data: any) {
        const player = this.players.get(sessionId);
        player.pX = data.pX;
        player.pY = data.pY;
        player.pZ = data.pZ;
        player.vX = data.vX;
        player.vY = data.vY;
        player.vZ = data.vZ;
        player.rX = data.rX;
        player.rY = data.rY;

        // console.log("Player position ", this.players.get(sessionId).x, " : " , this.players.get(sessionId).y);
    }
}

export class StateHandlerRoom extends Room<State> {
    maxClients = 2;
    private spawnPoints = new SpawnPoints();

    onCreate(options) {
        console.log("StateHandlerRoom created!", options);
        //this.setPatchRate(100);
        this.setState(new State());

        this.onMessage("move", (client, data) => {
            //console.log("StateHandlerRoom received message from", client.sessionId, ":", data);
            this.state.movePlayer(client.sessionId, data);
        });

        this.onMessage("shoot", (client, data) => {
            this.broadcast("Shoot", data, { except: client });
        });

        this.onMessage("damage", (client, data) => {
            const clientID = data.id;
            const player = this.state.players.get(clientID);
            let hp = player.currentHP - data.value;
            if (hp > 0) {
                player.currentHP = hp;
                return;
            }
            player.loss++;
            player.currentHP = player.maxHP;

            client.send("", "");
            for (var i = 0; i < this.clients.length; i++) {
                if (this.clients[i].id != clientID) continue;
                // const x = Math.floor(Math.random() * 50) - 25;
                // const z = Math.floor(Math.random() * 50) - 25;
                const respawnPoint = this.spawnPoints.getSpawnPoint();
                const x = respawnPoint.x;
                const z = respawnPoint.y;
                //TODO: Сделать передачу координаты y
                const message = JSON.stringify({ x, z });
                this.clients[i].send("Restart", message);
            }
        });

        this.onMessage("change", (client, data) => {
            this.broadcast("Change", data, { except: client });
        });
    }

    onAuth(client, options, req) {
        return true;
    }

    onJoin(client: Client, data: any) {
        if (this.clients.length > 1) this.lock();
        this.state.createPlayer(
            client.sessionId,
            data,
            this.spawnPoints.getSpawnPoint()
        );
    }

    onLeave(client) {
        this.state.removePlayer(client.sessionId);
    }

    onDispose() {
        console.log("Dispose StateHandlerRoom");
    }
}
type Point = { x: number; y: number; z: number };

class SpawnPoints {
    private prevSpawnPointIndex = -1;
    //Список точек спавна
    private points: Point[] = [
        { x: 10, y: 0, z: 10 },
        { x: 15, y: 0, z: 15 },
        { x: -10, y: 0, z: -10 },
        { x: -15, y: 0, z: -15 },
    ];

    getSpawnPoint(): Point {
        let randomIndex: number;
        //Выберем случайную точку, но не предыдущую
        do {
            randomIndex = Math.floor(Math.random() * this.points.length);
        } while (randomIndex == this.prevSpawnPointIndex);

        this.prevSpawnPointIndex = randomIndex;
        return this.points[randomIndex];
    }
}
