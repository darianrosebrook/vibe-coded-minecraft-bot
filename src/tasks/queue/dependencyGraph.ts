export class DependencyGraph {
  private nodes: Set<string> = new Set();
  private edges: Map<string, Set<string>> = new Map();

  addNode(nodeId: string): void {
    this.nodes.add(nodeId);
    if (!this.edges.has(nodeId)) {
      this.edges.set(nodeId, new Set());
    }
  }

  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.edges.delete(nodeId);
    for (const [_, dependents] of this.edges) {
      dependents.delete(nodeId);
    }
  }

  addEdge(from: string, to: string): void {
    if (!this.edges.has(from)) {
      this.edges.set(from, new Set());
    }
    this.edges.get(from)!.add(to);
  }

  removeEdge(from: string, to: string): void {
    this.edges.get(from)?.delete(to);
  }

  getReadyNodes(): string[] {
    const readyNodes: string[] = [];
    for (const nodeId of this.nodes) {
      let hasDependencies = false;
      for (const [_, dependents] of this.edges) {
        if (dependents.has(nodeId)) {
          hasDependencies = true;
          break;
        }
      }
      if (!hasDependencies) {
        readyNodes.push(nodeId);
      }
    }
    return readyNodes;
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }
} 