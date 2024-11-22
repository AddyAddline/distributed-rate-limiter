const crypto = require("crypto");

class ConsistentHash {
  constructor(nodes = [], replicas = 256) {
    this.replicas = replicas;
    this.ring = {};
    this.keys = [];
    nodes.forEach((node) => this.addNode(node));
  }

  addNode(node) {
    for (let i = 0; i < this.replicas; i++) {
      const hash = this.getHash(`${node}:${i}`);
      this.ring[hash] = node;
      this.keys.push(hash);
    }
    this.keys.sort();
  }

  removeNode(node) {
    for (let i = 0; i < this.replicas; i++) {
      const hash = this.getHash(`${node}:${i}`);
      delete this.ring[hash];
      this.keys = this.keys.filter((key) => key !== hash);
    }
  }

  getNode(key) {
    if (this.keys.length === 0) return null;

    const hash = this.getHash(key);
    const pos = this.findPosition(hash);
    return this.ring[this.keys[pos]];
  }

  findPosition(hash) {
    let left = 0;
    let right = this.keys.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.keys[mid] === hash) return mid;

      if (this.keys[mid] > hash) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return left === this.keys.length ? 0 : left;
  }

  getHash(key) {
    return crypto.createHash("md5").update(key).digest("hex");
  }
}

module.exports = ConsistentHash;
