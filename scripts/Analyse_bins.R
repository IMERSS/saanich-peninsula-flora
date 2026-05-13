library(MASS)
library(poweRlaw)

# --- 1. Read and sort data ---
v <- scan("viz_data/obsbins.txt", sep = ",", quiet = TRUE)
v <- sort(v[v > 0])

# --- 2. Estimate power-law exponent via MLE (Hill estimator) ---
x_min <- min(v)
alpha  <- 1 + length(v) / sum(log(v / x_min))
alpha = 1.2
cat("Estimated power-law exponent (alpha):", round(alpha, 4), "\n")

transform_exp <- alpha - 1   
cat("Transform exponent (1/(alpha-1)):", round(transform_exp, 4), "\n")

# --- 3. Transform the raw data, then rebin ---
v_transformed <- v ^ transform_exp

bins_orig <- seq(min(v),             max(v),             length.out = 41)
bins_tran <- seq(min(v_transformed), max(v_transformed), length.out = 41)

# --- 4. Compute PDFs from histograms (freq=FALSE gives density) ---
h_orig <- hist(v,             breaks = bins_orig, plot = FALSE)
h_tran <- hist(v_transformed, breaks = bins_tran, plot = FALSE)

# --- 5. Plot side by side ---
par(mfrow = c(1, 2))

plot(h_orig,
     freq   = FALSE,
     main   = paste0("Original PDF\n(alpha = ", round(alpha, 3), ")"),
     xlab   = "x",
     ylab   = "Density",
     col    = "steelblue",
     border = "white")

# Overlay theoretical power-law PDF for verification
x_seq <- seq(min(v), max(v), length.out = 200)
c_norm <- (alpha - 1) * x_min ^ (alpha - 1)   # normalisation constant
lines(x_seq, c_norm * x_seq ^ (-alpha), col = "red", lwd = 2)
legend("topright", legend = "Fitted power-law", col = "red", lwd = 2)

plot(h_tran,
     freq   = FALSE,
     main   = paste0("Transformed PDF\n(x ^ ", round(transform_exp, 3), ")"),
     xlab   = expression(x^{1/(alpha-1)}),
     ylab   = "Density",
     col    = "coral",
     border = "white")

# Overlay expected uniform density for verification
u_density <- 1 / (max(v_transformed) - min(v_transformed))
abline(h = u_density, col = "red", lwd = 2, lty = 2)
legend("topright", legend = "Expected uniform", col = "red", lwd = 2, lty = 2)

par(mfrow = c(1, 1))








# Only compare over the tail all distributions agree on
v_tail <- v[v >= x_min]
n_tail <- length(v_tail)

# Refit all distributions to the same tail subset
fit_ln_tail <- fitdistr(v_tail, "lognormal")
fit_gm_tail <- fitdistr(v_tail, "gamma")
fit_wb_tail <- fitdistr(v_tail, "weibull")

# Log-likelihoods on the tail, properly normalised
# Each continuous distribution must be renormalised to integrate to 1 above x_min

# Power-law (already defined over tail by construction)
ll_pl <- sum(log((alpha - 1) / x_min * (v_tail / x_min)^(-alpha)))
aic_pl_tail <- 2*1 - 2*ll_pl

# Log-normal: renormalise by P(X >= x_min)
p_ln  <- plnorm(x_min, fit_ln_tail$estimate["meanlog"],
                fit_ln_tail$estimate["sdlog"],  lower.tail = FALSE)
ll_ln <- sum(dlnorm(v_tail, fit_ln_tail$estimate["meanlog"],
                    fit_ln_tail$estimate["sdlog"], log = TRUE)) - n_tail * log(p_ln)
aic_ln_tail <- 2*2 - 2*ll_ln

# Gamma
p_gm  <- pgamma(x_min, fit_gm_tail$estimate["shape"],
                fit_gm_tail$estimate["rate"],   lower.tail = FALSE)
ll_gm <- sum(dgamma(v_tail, fit_gm_tail$estimate["shape"],
                    fit_gm_tail$estimate["rate"], log = TRUE)) - n_tail * log(p_gm)
aic_gm_tail <- 2*2 - 2*ll_gm

# Weibull
p_wb  <- pweibull(x_min, fit_wb_tail$estimate["shape"],
                  fit_wb_tail$estimate["scale"], lower.tail = FALSE)
ll_wb <- sum(dweibull(v_tail, fit_wb_tail$estimate["shape"],
                      fit_wb_tail$estimate["scale"], log = TRUE)) - n_tail * log(p_wb)
aic_wb_tail <- 2*2 - 2*ll_wb

cat("\nFair AIC comparison over tail (x >=", round(x_min, 4), "):\n")
cat("Power-law:", round(aic_pl_tail, 2), "\n")
cat("Log-normal:", round(aic_ln_tail, 2), "\n")
cat("Gamma:",     round(aic_gm_tail, 2), "\n")
cat("Weibull:",   round(aic_wb_tail, 2), "\n")




# --- Weibull linearisation ---
# If X ~ Weibull(k, lambda), then X^k ~ Exponential
# So the correct transform is v^k which should give an exponential distribution
# and log(v^k) = k*log(v) should be approximately linear on a log scale

k      <- fit_wb_tail$estimate["shape"]
lambda <- fit_wb_tail$estimate["scale"]

cat("Weibull shape (k):", round(k, 4), "\n")
cat("Weibull scale (lambda):", round(lambda, 4), "\n")

# Transform: X^k ~ Exponential(rate=1/lambda^k)
v_weibull_transformed <- v ^ k

# Rebin and plot alongside exponential reference
bins_wt <- seq(min(v_weibull_transformed), max(v_weibull_transformed), length.out = 21)
h_wt    <- hist(v_weibull_transformed, breaks = bins_wt, plot = FALSE)

# Expected exponential rate
exp_rate <- 1 / lambda ^ k

par(mfrow = c(1, 2))

# Original with Weibull fit
plot(h_orig,
     freq   = FALSE,
     main   = paste0("Original PDF\nWeibull(k=", round(k,3),
                     ", λ=", round(lambda,3), ")"),
     xlab   = "x",
     ylab   = "Density",
     col    = "steelblue",
     border = "white")

x_seq <- seq(min(v), max(v), length.out = 300)
lines(x_seq, dweibull(x_seq, k, lambda), col = "red", lwd = 2)

# Transformed: should look exponential
plot(h_wt,
     freq   = FALSE,
     main   = paste0("Transformed PDF\n(x ^ ", round(k, 3), ")"),
     xlab   = expression(x^k),
     ylab   = "Density",
     col    = "coral",
     border = "white")

x_seq_t <- seq(min(v_weibull_transformed), max(v_weibull_transformed), length.out = 300)
lines(x_seq_t, dexp(x_seq_t, rate = exp_rate), col = "red", lwd = 2)

par(mfrow = c(1, 1))



v_uniform <- pweibull(v, shape = k, scale = lambda)

hist(v_uniform,
     breaks = 21,
     freq   = FALSE,
     main   = "PIT transform (should be Uniform)",
     xlab   = "F(x)",
     col    = "coral",
     border = "white")
abline(h = 1, col = "red", lwd = 2, lty = 2)

## Verify with simple closed-form transform

v_uniform2 <- 1 - exp(-(v / 0.012)^0.51)

hist(v_uniform2,
     breaks = 21,
     freq   = FALSE,
     main   = "PIT transform (should be Uniform)",
     xlab   = "F(x)",
     col    = "coral",
     border = "white")
abline(h = 1, col = "red", lwd = 2, lty = 2)

x_seq <- seq(min(v), max(v), length.out = 500)
y_seq <- 1 - exp(-(x_seq / 0.012)^0.51)

plot(x_seq, y_seq,
     type = "l",
     lwd  = 2,
     col  = "steelblue",
     main = "Weibull CDF Transform",
     xlab = "x",
     ylab = "F(x)")
