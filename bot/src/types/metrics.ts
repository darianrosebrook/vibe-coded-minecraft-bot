export class WorldMetrics {
    private state: {
        position: { x: number; y: number; z: number };
        velocity: { x: number; y: number; z: number };
        yaw: number;
        pitch: number;
        onGround: boolean;
        isInWater: boolean;
        isInLava: boolean;
        isInWeb: boolean;
        isCollidedHorizontally: boolean;
        isCollidedVertically: boolean;
    };

    constructor() {
        this.state = {
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            yaw: 0,
            pitch: 0,
            onGround: false,
            isInWater: false,
            isInLava: false,
            isInWeb: false,
            isCollidedHorizontally: false,
            isCollidedVertically: false
        };
    }

    public update(metrics: Partial<typeof this.state>): void {
        this.state = { ...this.state, ...metrics };
    }

    public getState(): typeof this.state {
        return this.state;
    }
}

export class PerformanceTracker {
    private state: {
        fps: number;
        memoryUsage: number;
        cpuUsage: number;
        lastUpdate: number;
    };

    constructor() {
        this.state = {
            fps: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            lastUpdate: Date.now()
        };
    }

    public update(metrics: Partial<typeof this.state>): void {
        this.state = { ...this.state, ...metrics };
    }

    public getState(): typeof this.state {
        return this.state;
    }
} 