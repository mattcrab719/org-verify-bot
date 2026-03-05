import {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
SlashCommandBuilder,
REST,
Routes,
Events,
AttachmentBuilder
} from "discord.js"

import fs from "fs"

const TOKEN = process.env.TOKEN
const CLIENT_ID = process.env.CLIENT_ID
const GUILD_ID = process.env.GUILD_ID

/* CHANNELS */

const RATE_SUBMIT = "1479185567068717247"
const RATE_POST = "1479185540963238050"

const MOG_CHANNEL = "1473105456007479307"

const PROGRAM_CREATE = "1479188457770324028"
const PROGRAM_POST = "1479188564226084905"

const LEADERBOARD_CHANNEL = "1479188874147270766"

const STATS_CHANNEL = "1479190112821575680"

const ANNOUNCE_CHANNEL = "1473125728676610181"

/* DATABASE */

let db = {
ratings:{},
mog:{},
queue:[],
programs:{},
cooldowns:{}
}

if(fs.existsSync("db.json")){
db = JSON.parse(fs.readFileSync("db.json"))
}

function save(){
fs.writeFileSync("db.json",JSON.stringify(db,null,2))
}

/* CLIENT */

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMessageReactions
]
})

/* COMMANDS */

const commands = [

new SlashCommandBuilder()
.setName("rate")
.setDescription("Submit yourself for rating")
.addAttachmentOption(o=>o.setName("photo").setRequired(true)),

new SlashCommandBuilder()
.setName("ratingleaderboard")
.setDescription("Attractiveness leaderboard"),

new SlashCommandBuilder()
.setName("mogleaderboard")
.setDescription("Mog leaderboard"),

new SlashCommandBuilder()
.setName("stats")
.setDescription("Check stats")
.addUserOption(o=>o.setName("user").setRequired(true)),

new SlashCommandBuilder()
.setName("program")
.setDescription("Create looksmax program")
.addStringOption(o=>o.setName("name").setRequired(true))
.addStringOption(o=>o.setName("description").setRequired(true))
.addBooleanOption(o=>o.setName("approval").setRequired(true)),

new SlashCommandBuilder()
.setName("announcement")
.setDescription("Admin announcement")
.addStringOption(o=>o.setName("text").setRequired(true)),

new SlashCommandBuilder()
.setName("send")
.setDescription("Send message")
.addStringOption(o=>o.setName("text").setRequired(true))

].map(c=>c.toJSON())

client.once(Events.ClientReady, async ()=>{

const rest = new REST({version:"10"}).setToken(TOKEN)

await rest.put(
Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),
{body:commands}
)

console.log("Bot ready")

startLeaderboardLoop()

})

/* RATING BUTTONS */

function rateButtons(){

return new ActionRowBuilder().addComponents(

new ButtonBuilder().setCustomId("LTN").setLabel("LTN").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("MTN").setLabel("MTN").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("HTN").setLabel("HTN").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("CL").setLabel("CL").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("CHAD").setLabel("CHAD").setStyle(ButtonStyle.Danger)

)
}

/* INTERACTIONS */

client.on(Events.InteractionCreate, async i=>{

/* COMMANDS */

if(i.isChatInputCommand()){

/* RATE */

if(i.commandName==="rate"){

if(i.channel.id !== RATE_SUBMIT)
return i.reply({content:"Use rating channel",ephemeral:true})

const photo = i.options.getAttachment("photo")

const embed = new EmbedBuilder()
.setTitle("Looksmax Rating")
.setDescription(`${i.user}`)
.setImage(photo.url)

const ch = await client.channels.fetch(RATE_POST)

const msg = await ch.send({
embeds:[embed],
components:[rateButtons()]
})

db.ratings[msg.id] = {
user:i.user.id,
votes:{LTN:0,MTN:0,HTN:0,CL:0,CHAD:0},
voters:[]
}

save()

i.reply({content:"Submitted",ephemeral:true})

}

/* RATING LEADERBOARD */

if(i.commandName==="ratingleaderboard"){

let scores={}

for(const r of Object.values(db.ratings)){

const best = Object.entries(r.votes).sort((a,b)=>b[1]-a[1])[0]

if(!best) continue

scores[r.user] ??=0

scores[r.user]+=best[1]

}

let list = Object.entries(scores)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)

let text=list.map((u,i)=>`#${i+1} <@${u[0]}> ${u[1]}`).join("\n")

i.reply(text || "No data")

}

/* MOG LEADERBOARD */

if(i.commandName==="mogleaderboard"){

let list=Object.entries(db.mog)
.sort((a,b)=>b[1].wins-a[1].wins)
.slice(0,10)

let text=list.map((u,i)=>
`#${i+1} <@${u[0]}> W:${u[1].wins} L:${u[1].loss}`
).join("\n")

i.reply(text || "None")

}

/* USER STATS */

if(i.commandName==="stats"){

const user=i.options.getUser("user")

const mog=db.mog[user.id] || {wins:0,loss:0}

let ratings=Object.values(db.ratings).filter(r=>r.user===user.id).length

const embed=new EmbedBuilder()
.setTitle(`${user.username} Stats`)
.addFields(
{name:"Ratings Submitted",value:String(ratings)},
{name:"Mog Wins",value:String(mog.wins)},
{name:"Mog Losses",value:String(mog.loss)}
)

i.reply({embeds:[embed]})

}

/* PROGRAM */

if(i.commandName==="program"){

if(i.channel.id!==PROGRAM_CREATE)
return i.reply({content:"Use program channel",ephemeral:true})

const name=i.options.getString("name")
const desc=i.options.getString("description")
const approval=i.options.getBoolean("approval")

const id=Date.now()

db.programs[id]={
owner:i.user.id,
name,
desc,
approval,
members:[],
rating:0,
votes:0
}

save()

const embed=new EmbedBuilder()
.setTitle(name)
.setDescription(desc)
.setFooter({text:`Owner ${i.user.tag}`})

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`join_${id}`)
.setLabel("Join")
.setStyle(ButtonStyle.Success)
)

const ch=await client.channels.fetch(PROGRAM_POST)

ch.send({embeds:[embed],components:[row]})

i.reply({content:"Program created",ephemeral:true})

}

/* ADMIN */

if(i.commandName==="announcement"){

if(!i.member.permissions.has("Administrator"))
return i.reply({content:"Admin only",ephemeral:true})

const text=i.options.getString("text")

const ch=await client.channels.fetch(ANNOUNCE_CHANNEL)

ch.send(`📢 ${text}`)

i.reply({content:"Sent",ephemeral:true})

}

if(i.commandName==="send"){

if(!i.member.permissions.has("Administrator"))
return i.reply({content:"Admin only",ephemeral:true})

const text=i.options.getString("text")

i.channel.send(text)

i.reply({content:"Sent",ephemeral:true})

}

}

/* BUTTONS */

if(i.isButton()){

/* PROGRAM JOIN */

if(i.customId.startsWith("join_")){

const id=i.customId.split("_")[1]

const p=db.programs[id]

if(!p) return

if(p.members.includes(i.user.id))
return i.reply({content:"Already joined",ephemeral:true})

if(p.approval){

const owner=await client.users.fetch(p.owner)

owner.send(`${i.user.tag} wants to join ${p.name}`)

i.reply({content:"Request sent",ephemeral:true})

}else{

p.members.push(i.user.id)

save()

i.reply({content:"Joined",ephemeral:true})

}

}

/* RATING VOTES */

const rating=db.ratings[i.message.id]

if(rating){

if(rating.voters.includes(i.user.id))
return i.reply({content:"Already voted",ephemeral:true})

rating.voters.push(i.user.id)

rating.votes[i.customId]++

if(rating.voters.length>=50){

const winner=Object.entries(rating.votes)
.sort((a,b)=>b[1]-a[1])[0][0]

const user=await client.users.fetch(rating.user)

user.send(`Your rating result: ${winner}`)

}

save()

i.reply({content:`Voted ${i.customId}`,ephemeral:true})

}

}

})

/* MOG BATTLES */

client.on(Events.MessageCreate, async m=>{

if(m.author.bot) return

if(m.channel.id!==MOG_CHANNEL) return

if(m.attachments.size===0) return

let now=Date.now()

if(db.cooldowns[m.author.id] && now-db.cooldowns[m.author.id] < 300000)
return m.reply("5 minute cooldown")

db.cooldowns[m.author.id]=now

db.queue.push({
user:m.author.id,
photo:m.attachments.first().url
})

save()

m.reply("Queued")

if(db.queue.length>=2){

const p1=db.queue.shift()
const p2=db.queue.shift()

const embed=new EmbedBuilder()
.setTitle("Mog Battle")
.setDescription(`<@${p1.user}> vs <@${p2.user}>`)
.setImage(p1.photo)

const embed2=new EmbedBuilder()
.setImage(p2.photo)

const msg=await m.channel.send({embeds:[embed,embed2]})

await msg.react("⬅️")
await msg.react("➡️")

setTimeout(async()=>{

const battle=await m.channel.messages.fetch(msg.id)

const left=battle.reactions.cache.get("⬅️")?.count || 0
const right=battle.reactions.cache.get("➡️")?.count || 0

const winner=left>right?p1.user:p2.user
const loser=left>right?p2.user:p1.user

db.mog[winner] ??={wins:0,loss:0}
db.mog[loser] ??={wins:0,loss:0}

db.mog[winner].wins++
db.mog[loser].loss++

save()

m.channel.send(`🏆 <@${winner}> wins the mog battle`)

},10800000)

}

})

/* AUTO GRAPHIC LEADERBOARDS */

function startLeaderboardLoop(){

setInterval(async()=>{

const ch=await client.channels.fetch(LEADERBOARD_CHANNEL)

let ratingTop=Object.entries(db.ratings).slice(0,5)
let mogTop=Object.entries(db.mog).sort((a,b)=>b[1].wins-a[1].wins).slice(0,5)

const embed=new EmbedBuilder()
.setTitle("Server Leaderboards")
.addFields(
{name:"Top Moggers",value:mogTop.map((u,i)=>`#${i+1} <@${u[0]}> ${u[1].wins} wins`).join("\n") || "None"},
{name:"Top Rated",value:ratingTop.map((u,i)=>`#${i+1} <@${u[1].user}>`).join("\n") || "None"}
)

ch.send({embeds:[embed]})

},300000)

}

client.login(TOKEN)
