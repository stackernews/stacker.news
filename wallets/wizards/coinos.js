import { nwcSchema, lnAddrSchema } from '@/lib/validate'

export const title = 'coinos'
export const authors = ['supratic']
export const icon = 'https://coinos.io/icons/logo.svg'
export const description = '[Coinos](https://coinos.io/) wallet'

const step1 = async (stepsData, wallets) => {
  return {
    name: 'SignUp',
    title: 'Sign Up',
    description: `
Create a Coinos account on https://Coinos.io/register, fyi... it's KYC free, 
so no question asked on signup apart username and password. 
You can have it fully anonymous, clicking on the 🎲 and it will generate a random username for you. 
Make sure your password is secure.
    `,
    fields: []
  }
}

const step2 = async (stepsData, wallets) => {
  return {
    name: 'NWC',
    title: 'Get NWC',
    description: `
Once you have your whateverusername@coinos.os account...
![image](https://imgprxy.stacker.news/R1tVUU8XIXA5s0rqoL6d3x4syJDnq4r_BXgdqvDGfyM/rs:fit:1920:1080/aHR0cHM6Ly9tLnN0YWNrZXIubmV3cy81MzMxMQ)
... expand the details.
![image](https://imgprxy.stacker.news/G9oqobqhSGEt37-sq7LStJqtJ880QSEYCEX8aD-sdig/rs:fit:1920:1080/aHR0cHM6Ly9tLnN0YWNrZXIubmV3cy81MzMxMw)
Then copy the Nostr Wallet Connect url and paste it below
    `,
    fields: [
      {
        name: 'nwcAddr',
        label: 'Input the NWC url',
        type: 'password',
        placeholder: 'nostr+walletconnect://...',
        autoComplete: 'off'
      }
    ],
    fieldValidation: nwcSchema
  }
}

const step3 = async (stepsData, wallets) => {
  return {
    name: 'lnAddress',
    title: 'Get LN Address',
    description: `
Once you have your whateverusername@coinos.os account...
![image](https://imgprxy.stacker.news/R1tVUU8XIXA5s0rqoL6d3x4syJDnq4r_BXgdqvDGfyM/rs:fit:1920:1080/aHR0cHM6Ly9tLnN0YWNrZXIubmV3cy81MzMxMQ)
... expand the details.
![image](hhttps://imgprxy.stacker.news/jnrYBUi4dmYkO4SpDuJcc6Ww9D7GfIHTN_o8nuKvCn0/rs:fit:1600:900/aHR0cHM6Ly9tLnN0YWNrZXIubmV3cy81MzMxMg)
Then copy that lightning address and paste it below.
    `,
    fields: [
      {
        name: 'lnAddr',
        label: 'Input the Lightning Address',
        type: 'text',
        placeholder: '...@coinos.io',
        autoComplete: 'off'
      }
    ],
    fieldValidation: lnAddrSchema
  }
}

const step4 = async (stepsData, wallets) => {
  try {
    console.log(stepsData)
    const nwcUrl = stepsData.NWC.nwcAddr
    const lnAddress = stepsData.lnAddress.lnAddr

    await wallets.connect(
      'nwc', // connector
      { // fields
        nwcUrl
      },
      'coinos' // label
    )
    await wallets.connect(
      'lightning-address', // connector
      { // fields
        address: lnAddress
      },
      'coinos' // label
    )
    return {
      name: 'final',
      title: 'Connected!',
      description: `
You have successfully connected your Coinos wallet!
      `,
      fields: []
    }
  } catch (e) {
    return {
      name: 'error',
      title: 'Error',
      description: `
There was an error connecting your Coinos wallet. Please try again.

Error: ${e.message}
      `,
      fields: []
    }
  }
}

export const steps = [step1, step2, step3, step4]
