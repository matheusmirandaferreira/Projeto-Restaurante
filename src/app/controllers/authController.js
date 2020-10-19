const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const mailer = require('../../modules/mailer')

const User = require('../models/User')

const router = express.Router()

router.post('/register', async (req, res) => {
    const { email } = req.body
    
    try {
        if (await User.findOne({ email }))
        return res.status(400).send({ error: 'User already exists' })

        const user = await User.create(req.body);

        user.password = undefined

        return res.redirect('/login')

    } catch (err) {
        return res.status(400).send({ error: 'Registration failed' })
    }
})

router.post('/authenticate', async (req, res) => {
    const { email, password } = req.body

    const user = await User.findOne({ email }).select('+password')

    if (!user)
        return res.status(400).send({ error: 'User not found' })

    if (!await bcrypt.compare(password, user.password))
        return res.status(400).send({ error: 'Invalid password' })

    user.password = undefined;
    
    return res.redirect('/home')
})

router.post('/forgot_password', async (req, res) => {
    const { email } = req.body

    try {
        const user = await User.findOne({ email })

        if (!user)
            return res.status(400).send({ error: 'User not found' })

        const token = crypto.randomBytes(20).toString('hex')

        const now = new Date()
        now.setHours(now.getHours() + 1)

        await User.findOneAndUpdate({ email: user.email },
            {
                '$set': {
                    passwordResetToken: token,
                    passwordResetExpires: now,
                }
            })

        mailer.sendMail({
            to: email,
            from: 'ohhhmiranha@gmail.com.br',
            template: 'auth/forgot_password',
            context: { token },
        }, (err) => {
            if (err) {
                console.log(err)
                return res.status(400).send({ error: 'Cannot send forgot password email.' })
            }

            return res.redirect('/reset-password')
        })
    } catch (err) {
        return res.status(400).send({ error: 'Erro on forgot password, try again' })
    }

})

router.post('/reset_password', async (req, res) => {
    const { email, token, password } = req.body

    try {
        const user = await User.findOne({ email })

        if (!user)
            return res.status(400).send({ error: 'User not found' })

        if (token !== user.passwordResetToken)
            return res.status(400).send({ error: 'Token invalid2' })

        const now = new Date()

        if (now > user.passwordResetExpires)
            return res.status(400).send({ error: 'Token expired, generate a new one' })

        user.password = password;

        await user.save()

        return res.redirect('/login')
    } catch (err) {
        res.status(400).send({ error: 'Cannot reset password, try again.' })
    }
})

module.exports = app => app.use('/auth', router);