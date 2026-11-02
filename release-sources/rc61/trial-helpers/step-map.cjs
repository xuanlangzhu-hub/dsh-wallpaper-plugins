// Reject duplicate initializer names before a runner can select or spawn a step.
function defineSteps(entries) {
 const steps=Object.create(null);
 for(const [name,value] of entries){
  if(!/^[A-Za-z][A-Za-z0-9]*$/.test(name)||Object.hasOwn(steps,name))throw Error('Invalid or duplicate step: '+name);
  steps[name]=value;
 }
 return steps;
}
module.exports={defineSteps};
