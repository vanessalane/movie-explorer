const { User, Comment, Movie } = require('../models');
const { signToken } = require('../utils/auth');
const { AuthenticationError } = require('apollo-server-express');

const resolvers = {
    Query: {
        me: async (parent, args, context) => {
            if(context.user) {
                const userData = await User.findOne({ _id: context.user._id })
                    .select('-__v -password')
                    .populate('comments')
                    .populate('friends')
                    .populate('savedMovies')
                    .populate('removedMovies');
                return userData;
            }

            throw new AuthenticationError('Not logged in');
        },

        // get all comments
        comments: async (parent, { username }) => {
            const params = username ? { username } : {};
            return Comment.find(params).sort({ createdAt: -1 });
        },

        // get one comment
        comment: async (parent, { _id }) => {
            return Comment.findOne({ _id });
        },

        // get all users
        users: async () => {
            return User.find()
                .select('-__v -password')
                .populate('friends')
                .populate('comments')
                .populate('savedMovies')
                .populate('removedMovies');
        },

        // get a user by username
        user: async (parent, { username }) => {
            return User.findOne({ username })
                .select('-__v -password')
                .populate('friends')
                .populate('comments')
                .populate('savedMovies')
                .populate('removedMovies');
        },
    },

    Mutation: {
        addUser: async (parent, args) => {
            const user = await User.create(args);
            const token = signToken(user);

            return { token, user };
        },

        login: async (parent, { email, password }) => {
            const user = await User.findOne({ email });

            if (!user) {
                throw new AuthenticationError('Incorrect credentials');
            }

            const correctPw = await user.isCorrectPassword(password);

            if (!correctPw) {
                throw new AuthenticationError('Incorrect credentials');
            }

            const token = signToken(user);
            return { token, user };
        },

        addComment: async (parent, args, context) => {
            if (context.user) {
                const comment = await Comment.create({ ...args, username: context.user.username });

                await User.findByIdAndUpdate(
                    { _id: context.user._id },
                    { $push: { comments: comment._id } },
                    { new: true }
                );

                return comment;
            }

            throw new AuthenticationError('You need to be logged in!');
        },

        addReaction: async (parent, { commentId, reactionBody }, context) => {
            if (context.user) {
                const updatedComment = await Comment.findOneAndUpdate(
                    { _id: commentId },
                    { $push: { reactions: { reactionBody, username: context.user.username } } },
                    { new: true, runValidators: true }
                );

                return updatedComment;
            }

            throw new AuthenticationError('You need to be logged in!');
        },

        addFriend: async (parent, { friendId }, context) => {
            if (context.user) {
                const updatedUser = await User.findOneAndUpdate(
                    { _id: context.user._id },
                    { $addToSet: { friends: friendId } },
                    { new: true }
                ).populate('friends');

                return updatedUser;
            }

            throw new AuthenticationError('You need to be logged in!');
        },

        saveMovie: async (parent, { input }, context) => {
            if (context.user) {
                const updatedUser = await User.findByIdAndUpdate(
                    { _id: context.user._id },
                    {
                        $addToSet: { savedMovies: input },
                        $pull: { removedMovies: input.movieId } 
                    },
                    { new: true }
                );
                return updatedUser;
            }
            throw new AuthenticationError('You need to be logged in!')
        },

        removeMovie: async (parent, { movieId }, context) => {
            console.log("Attempting to remove movie", movieId)
            console.log("context", context.user)
            if (context.user) {
                console.log("Attempting to remove movie in conext.user", movieId)
                const user = await User.findOne({_id: context.user._id});
                let savedMovies = user.savedMovies; 
                let toRemove = savedMovies.filter(sm => sm.movieId == movieId)[0];

                const updatedUser = await User.findOneAndUpdate(
                    { _id: context.user._id },
                    {
                        $addToSet: { removedMovies: toRemove },
                        $pull: { savedMovies: { movieId } } 
                    },
                    { new: true }
                );
                return updatedUser;
            }
            throw new AuthenticationError('You need to be logged in!')
        }
    }
};

module.exports = resolvers;