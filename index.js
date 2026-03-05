import { 
Client, 
GatewayIntentBits, 
EmbedBuilder, 
ActionRowBuilder, 
ButtonBuilder, 
ButtonStyle 
} from "discord.js"

import fs from "fs"

const TOKEN = "PUT_YOUR_TOKEN_HERE"

const client = new Client({
intents: [GatewayIntentBits.Guilds]
})

let data = {}
let battles = {}
let cooldowns = {}

if(fs.existsSync("data.json")){
data = JSON.parse(fs.readFileSync("data.json"))
}

function save(){
fs.writeFileSync("data.json", JSON.stringify(data,null,2))
}

function getUser(id){

if(!data[id]){

data[id] = {
rating:1000,
wins:0,
losses:0,
streak:0,
bestStreak:0,
battles:0,
program:false
}

}

return data[id]

}

client.once("ready",()=>{

console.log("Bot Ready")

setInterval(updatePanels,30000)

})

client.on("interactionCreate", async interaction=>{

if(!interaction.isChatInputCommand()) return

if(interaction.commandName === "battle"){

const user = interaction.options.getUser("user")
const image1 = interaction.options.getString("image1")
const image2 = interaction.options.getString("image2")

const now = Date.now()

if(cooldowns[interaction.user.id] && now - cooldowns[interaction.user.id] < 300000){

return interaction.reply({
content:"Cooldown 5 minutes",
ephemeral:true
})

}

cooldowns[interaction.user.id] = now

const battleID = Date.now().toString()

battles[battleID] = {

user1:interaction.user.id,
user2:user.id,
votes1:0,
votes2:0,
voters:[],
finished:false

}

const embed = new EmbedBuilder()

.setTitle("MOG BATTLE")

.setDescription(
`<@${interaction.user.id}> VS <@${user.id}>`
)

.addFields(
{name:"Player 1",value:`<@${interaction.user.id}>`,inline:true},
{name:"Player 2",value:`<@${user.id}>`,inline:true}
)

.setImage(image1)

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId(`vote1_${battleID}`)
.setLabel("Vote Player 1")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId(`vote2_${battleID}`)
.setLabel("Vote Player 2")
.setStyle(ButtonStyle.Danger)

)

await interaction.reply({
embeds:[embed],
components:[row]
})

}

})

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return

const id = interaction.customId.split("_")

const vote = id[0]
const battleID = id[1]

const battle = battles[battleID]

if(!battle || battle.finished) return

if(battle.voters.includes(interaction.user.id)){

return interaction.reply({
content:"You already voted",
ephemeral:true
})

}

if(interaction.user.id === battle.user1 || interaction.user.id === battle.user2){

return interaction.reply({
content:"Battlers cannot vote",
ephemeral:true
})

}

battle.voters.push(interaction.user.id)

if(vote === "vote1") battle.votes1++
if(vote === "vote2") battle.votes2++

await interaction.reply({
content:"Vote counted",
ephemeral:true
})

if(battle.votes1 + battle.votes2 >= 50){

finishBattle(battleID)

}

})

async function finishBattle(id){

const battle = battles[id]

battle.finished = true

const u1 = getUser(battle.user1)
const u2 = getUser(battle.user2)

let winner
let loser

if(battle.votes1 > battle.votes2){

winner = u1
loser = u2

u1.wins++
u2.losses++

u1.rating += 20
u2.rating -= 20

}else{

winner = u2
loser = u1

u2.wins++
u1.losses++

u2.rating += 20
u1.rating -= 20

}

winner.streak++
loser.streak = 0

if(winner.streak > winner.bestStreak){

winner.bestStreak = winner.streak

}

u1.battles++
u2.battles++

save()

try{

const user1 = await client.users.fetch(battle.user1)
const user2 = await client.users.fetch(battle.user2)

user1.send(`Battle finished. Votes ${battle.votes1}-${battle.votes2}`)
user2.send(`Battle finished. Votes ${battle.votes1}-${battle.votes2}`)

}catch{}

}

async function updatePanels(){

const guild = client.guilds.cache.first()

if(!guild) return

const channel = guild.channels.cache.find(c=>c.name==="leaderboards")

if(!channel) return

const users = Object.entries(data)

.sort((a,b)=>b[1].rating - a[1].rating)

.slice(0,10)

let text=""

users.forEach((u,i)=>{

text += `${i+1}. <@${u[0]}> — ${u[1].rating}\n`

})

const embed = new EmbedBuilder()

.setTitle("Top Players")

.setDescription(text || "No players")

const msgs = await channel.messages.fetch({limit:5})

const msg = msgs.find(m=>m.author.id === client.user.id)

if(msg){

msg.edit({embeds:[embed]})

}else{

channel.send({embeds:[embed]})

}

}

client.login(TOKEN)
