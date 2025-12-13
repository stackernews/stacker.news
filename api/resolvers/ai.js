import { gql } from 'graphql-tag'

const { GoogleGenerativeAI } = require("@google/generative-ai");


console.log("AI Resolver Loaded");

export default {
    Query: {
        getClarification: async (parent, { itemId, term }, { models }) => {
            // Check if clarification exists
            let clarification = await models.itemClarification.findUnique({
                where: {
                    itemId_term: {
                        itemId: Number(itemId),
                        term
                    }
                }
            })

            if (!clarification) {
                try {
                    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                    const prompt = `Explain the term "${term}" in the context of the discussion on item ${itemId}. Keep it concise.`;
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    const text = response.text();

                    clarification = await models.itemClarification.create({
                        data: {
                            itemId: Number(itemId),
                            term,
                            text
                        }
                    })
                } catch (error) {
                    console.error("Error generating clarification:", error);
                    throw new Error("Failed to generate clarification");
                }
            }

            return clarification
        }
    },
}
