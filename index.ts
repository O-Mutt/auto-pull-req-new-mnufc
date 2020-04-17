import start from './src/auto-pull-req-new-mnufc';


exports.handler =  async function(event: any, context: any) {
  await start(context);
  return context.logStreamName
}
