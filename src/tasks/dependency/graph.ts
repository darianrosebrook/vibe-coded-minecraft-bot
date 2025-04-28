import { Task } from '@/types';
import { TaskNode, DependencyGraph as DependencyGraphInterface } from '@/types';
import { TaskNode as TaskNodeClass } from './node';

export class DependencyGraph implements DependencyGraphInterface {
  public readonly nodes: Map<string, TaskNode>;
  public readonly edges: Map<string, Set<string>>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  public addNode(task: Task, id?: string): TaskNode {
    const node = new TaskNodeClass(task, id);
    this.nodes.set(node.id, node);
    this.edges.set(node.id, new Set());
    return node;
  }

  public removeNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) {
      return;
    }

    // Remove all edges pointing to this node
    for (const [sourceId, targets] of this.edges) {
      if (targets.has(nodeId)) {
        targets.delete(nodeId);
        const sourceNode = this.nodes.get(sourceId);
        if (sourceNode) {
          sourceNode.removeDependent(nodeId);
        }
      }
    }

    // Remove all edges from this node
    const node = this.nodes.get(nodeId);
    if (node) {
      for (const dependencyId of node.dependencies) {
        const dependencyNode = this.nodes.get(dependencyId);
        if (dependencyNode) {
          dependencyNode.removeDependent(nodeId);
        }
      }
    }

    this.nodes.delete(nodeId);
    this.edges.delete(nodeId);
  }

  public addEdge(fromId: string, toId: string): void {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      throw new Error('One or both nodes do not exist');
    }

    const fromNode = this.nodes.get(fromId)!;
    const toNode = this.nodes.get(toId)!;

    this.edges.get(fromId)!.add(toId);
    fromNode.addDependent(toId);
    toNode.addDependency(fromId);
  }

  public removeEdge(fromId: string, toId: string): void {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      return;
    }

    const fromNode = this.nodes.get(fromId)!;
    const toNode = this.nodes.get(toId)!;

    this.edges.get(fromId)!.delete(toId);
    fromNode.removeDependent(toId);
    toNode.removeDependency(fromId);
  }

  public hasCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleUtil = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const dependentId of node.dependents) {
          if (hasCycleUtil(dependentId)) {
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (hasCycleUtil(nodeId)) {
        return true;
      }
    }

    return false;
  }

  public getTopologicalOrder(): string[] {
    if (this.hasCycle()) {
      throw new Error('Graph contains cycles, cannot perform topological sort');
    }

    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (node) {
        for (const dependentId of node.dependents) {
          visit(dependentId);
        }
      }
      order.unshift(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return order;
  }

  public getReadyNodes(): TaskNode[] {
    return Array.from(this.nodes.values())
      .filter(node => node.isReady() && !node.hasDependencies());
  }

  public getNode(nodeId: string): TaskNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getDependencies(nodeId: string): Set<string> {
    const node = this.nodes.get(nodeId);
    return node ? new Set(node.dependencies) : new Set();
  }

  public getDependents(nodeId: string): Set<string> {
    const node = this.nodes.get(nodeId);
    return node ? new Set(node.dependents) : new Set();
  }

  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }
} 