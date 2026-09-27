import {CLUSTER} from './cluster.js';
import {listen,send} from './transport.js';

interface NodeData {
  id: string;
  host: string;
  port: number;
}

export class Node {
  private id: string;
  private currentTerm: number;

  private otherNodes: Array<NodeData>;
  private currentVote: string | null;

  private heartbeatTimer: NodeJS.Timeout | null;
  private electionTimer: NodeJS.Timeout | null;

  private role: "follower" | "candidate" | "leader";


  constructor(id: string) {
    this.id = id;
    this.currentTerm = 0;
    this.role = "follower";
    this.currentVote = null;
    this.electionTimer = null;
    this.heartbeatTimer = null;
    this.otherNodes = CLUSTER.filter((item) => item.id != id);
    this.restartCountDown();
  }

  private sendHeartbeat() {}

  private stepDown(newTerm: number) {
    if (this.currentTerm < newTerm) this.currentTerm = newTerm;

    this.role = "follower";
    this.currentVote = null;

    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);

    this.heartbeatTimer = null;
  }

  private startElection() {
    
    var totalVotes = 0;
    
    this.role = "candidate";
    this.currentTerm+=1;
    this.currentVote=this.id;
    this.restartCountDown();

    for(const node of this.otherNodes) {
      send<{term:number,granted: boolean}>(node,'vote',{term:this.currentTerm,id:this.id}).then((res)=>{
             
          const ans = res;
          if(!ans)
            return;

          if(ans.term > this.currentTerm) {
            this.stepDown(ans.term);
            return;
          }
          
          if(ans.term == this.currentTerm && ans.granted) {
            totalVotes++;
            if(totalVotes >= Math.floor(CLUSTER.length/2)+1 && this.role === 'candidate')
            {
              this.makeLeader();
            }

          }
              
      })
    }
  }

  private restartCountDown() {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
    }
    this.electionTimer = setTimeout(() => {
      this.startElection();
    }, 1500+Math.random()*1500);
  }
}